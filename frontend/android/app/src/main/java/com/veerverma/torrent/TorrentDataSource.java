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
 * A read blocks in {@link TorrentEngine#waitForPiece} until the piece it
 * needs exists, then reads straight off disk. This is the same "serve the
 * growing file directly, gatekept by a blocking piece-wait" pattern
 * TorrentStream-Android uses, adapted to media3's DataSource extension
 * point instead of handing a file off to an external player.
 */
@UnstableApi
public class TorrentDataSource extends BaseDataSource {

    /** One factory/engine per active torrent stream. */
    public static class Factory implements DataSource.Factory {
        private final TorrentEngine engine;
        private final TorrentEngine.FileHandle fileHandle;

        public Factory(TorrentEngine engine, TorrentEngine.FileHandle fileHandle) {
            this.engine = engine;
            this.fileHandle = fileHandle;
        }

        @Override
        public DataSource createDataSource() {
            return new TorrentDataSource(engine, fileHandle);
        }
    }

    private final TorrentEngine engine;
    private final TorrentEngine.FileHandle fileHandle;

    private RandomAccessFile raf;
    private long position;
    private long endPosition; // exclusive
    private boolean opened;

    private TorrentDataSource(TorrentEngine engine, TorrentEngine.FileHandle fileHandle) {
        super(/* isNetwork= */ false);
        this.engine = engine;
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

    @Override
    public int read(byte[] buffer, int offset, int length) throws IOException {
        if (length == 0) return 0;
        if (position >= endPosition) return C.RESULT_END_OF_INPUT;
        if (engine.isStopped()) throw new IOException("Torrent stream stopped");

        int piece = engine.pieceForFileOffset(position);
        try {
            engine.waitForPiece(piece);
        } catch (IOException e) {
            throw e; // stream was stopped — propagate as a real read failure
        }

        // Never read past the current piece's boundary in one call, so we
        // never touch bytes libtorrent hasn't finished writing yet even
        // though the piece is marked "have" (avoids a false EOF from reading
        // ahead of what's actually flushed to disk).
        long pieceEndByte = engine.pieceEndByteForFile(piece);
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
