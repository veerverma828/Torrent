import { createContext, useContext, useMemo, useRef, useState } from "react";

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [streamUrl, setStreamUrl] = useState(null);
  const [fileModalData, setFileModalData] = useState(null);
  const [processingMagnet, setProcessingMagnet] = useState(null);
  const [processingFile, setProcessingFile] = useState(null);

  const videoRef = useRef(null);
  const currentMagnet = useRef(null);

  const value = useMemo(
    () => ({
      streamUrl,
      setStreamUrl,
      fileModalData,
      setFileModalData,
      processingMagnet,
      setProcessingMagnet,
      processingFile,
      setProcessingFile,
      videoRef,
      currentMagnet,
    }),
    [streamUrl, fileModalData, processingMagnet, processingFile]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayerContext() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayerContext must be used within PlayerProvider");
  return ctx;
}
