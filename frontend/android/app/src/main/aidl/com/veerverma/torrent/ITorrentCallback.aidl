package com.veerverma.torrent;

// Delivered from the isolated :torrent process back to the main process.
oneway interface ITorrentCallback {
    void onStage(String stage);
    void onStatus(int peers, long downloadRate, float progress);
    void onReady(String filePath, long fileSize, long fileOffset, int pieceLength);
    void onError(String message);
}
