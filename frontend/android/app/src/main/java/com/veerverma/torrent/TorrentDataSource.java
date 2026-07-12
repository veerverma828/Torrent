package com.veerverma.torrent;

import android.net.Uri;

import androidx.annotation.Nullable;
import androidx.media3.common.C;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.BaseDataSource;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DataSpec;

import java.io.IOException;
import java.io.RandomAccessFile;

/**
 * Feeds ExoPlayer directly from a torrent's growing file — no local HTTP
 * server, no sockets, none of the timeout surface that comes with them.
 *
 * The actual libtorrent4j engine runs in an isolated process (see
 * TorrentEngineService) so a native crash there can't take this process
 * down; a read polls {@link TorrentEngineClient#havePiece} over IPC until
 * the piece it needs exists, then reads straight off the shared-filesystem
 * file. This is the same "serve the growing file directly, gatekept by a
 * blocking piece-wait" pattern TorrentStream-Android uses, adapted to
 * media3's DataSource extension point and split across the process
 * boundary.
 */
@UnstableApi
public class TorrentDataSource extends BaseDataSource {

    private static final long POLL_INTERVAL_MS = 150;

    /** One factory/client per active torrent stream. */
    public static class Factory implements DataSource.Factory {
        private final TorrentEngineClient client;
        private final TorrentEngineClient.FileHandle fileHandle;

        public Factory(TorrentEngineClient client, TorrentEngineClient.FileHandle fileHandle) {
            this.client = client;
            this.fileHandle = fileHandle;
        }

        @Override
        public DataSource createDataSource() {
            return new TorrentDataSource(client, fileHandle);
        }
    }

    private final TorrentEngineClient client;
    private final TorrentEngineClient.FileHandle fileHandle;

    private RandomAccessFile raf;
    private long position;
    private long endPosition; // exclusive
    private boolean opened;

    private TorrentDataSource(TorrentEngineClient client, TorrentEngineClient.FileHandle fileHandle) {
        super(/* isNetwork= */ false);
        this.client = client;
        this.fileHandle = fileHandle;
    }

    @Override
    public long open(DataSpec dataSpec) throws IOException {
        transferInitializing(dataSpec);

        raf = new RandomAccessFile(fileHandle.file, "r");
        position = dataSpec.position;
        long available = fileHandle.size - position;
        long length = dataSpec.length != C.LENGTH_UNSET ? dataSpec.length : available;
        endPosition = position + length;

        opened = true;
        transferStarted(dataSpec);
        return length;
    }

    private int pieceForFileOffset(long fileByte) {
        return (int) ((fileHandle.fileOffset + fileByte) / fileHandle.pieceLength);
    }

    private long pieceEndByteForFile(int piece) {
        return ((long) (piece + 1) * fileHandle.pieceLength) - fileHandle.fileOffset - 1;
    }

    /** Blocks (polling over IPC) until the piece exists or the stream is
     *  stopped/crashed — no timeout, matching TorrentStream-Android: a slow
     *  piece just makes the read wait longer, it never kills playback. */
    private void waitForPiece(int piece) throws IOException {
        while (!client.havePiece(piece)) {
            if (client.isStopped()) throw new IOException("Torrent stream stopped");
            client.requestPieces(piece, 12);
            try {
                Thread.sleep(POLL_INTERVAL_MS);
            } catch (InterruptedException ignored) {
            }
        }
    }

    @Override
    public int read(byte[] buffer, int offset, int length) throws IOException {
        if (length == 0) return 0;
        if (position >= endPosition) return C.RESULT_END_OF_INPUT;
        if (client.isStopped()) throw new IOException("Torrent stream stopped");

        int piece = pieceForFileOffset(position);
        waitForPiece(piece);

        // Never read past the current piece's boundary in one call, so we
        // never touch bytes libtorrent hasn't finished writing yet even
        // though the piece is marked "have" (avoids a false EOF from reading
        // ahead of what's actually flushed to disk).
        long pieceEndByte = pieceEndByteForFile(piece);
        long readLimit = Math.min(endPosition - 1, pieceEndByte);
        int toRead = (int) Math.min(length, readLimit - position + 1);
        if (toRead <= 0) toRead = 1;

        raf.seek(position);
        int read = raf.read(buffer, offset, toRead);
        if (read == -1) {
            // The piece is "have" but the OS-visible file hasn't caught up
            // yet (flush lag) — this is NOT end of stream. Retry instead of
            // ever reporting a false EOF, which previously made ExoPlayer
            // think playback legitimately ended partway through a movie.
            try {
                Thread.sleep(50);
            } catch (InterruptedException ignored) {
            }
            return read(buffer, offset, length);
        }

        position += read;
        bytesTransferred(read);
        return read;
    }

    @Nullable
    @Override
    public Uri getUri() {
        return Uri.fromFile(fileHandle.file);
    }

    @Override
    public void close() throws IOException {
        if (raf != null) {
            raf.close();
            raf = null;
        }
        if (opened) {
            opened = false;
            transferEnded();
        }
    }
}
