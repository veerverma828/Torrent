package com.veerverma.torrent;

import com.veerverma.torrent.ITorrentCallback;

// Runs in the isolated :torrent process (see AndroidManifest.xml). All the
// risky native libtorrent4j work happens here, so a native (non-Java) crash
// only kills this process — the main app/player process detects it via
// onServiceDisconnected and shows a recoverable error instead of vanishing.
interface ITorrentEngineService {
    // Fire-and-forget: startTorrent can run for up to ~90s internally, so it
    // must not block the calling Binder thread for that whole duration.
    // Every result (stage/status/ready/error) comes back via the callback.
    oneway void warmUp();
    oneway void startTorrent(String magnet, ITorrentCallback callback);
    oneway void stopTorrent();

    // Synchronous: cheap, needs a return value, called frequently while
    // reading (TorrentDataSource polls this).
    boolean havePiece(int pieceIndex);
    void requestPieces(int startPiece, int count);
}
