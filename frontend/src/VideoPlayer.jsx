import React, { useEffect, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";

const VideoPlayer = (props) => {
    const videoRef = useRef(null);
    const playerRef = useRef(null);
    const { options, onReady, onError } = props;

    useEffect(() => {
        // Make sure Video.js player is only initialized once
        if (!playerRef.current) {
            // The Video.js player needs to be _inside_ the component el for React 18 Strict Mode.
            const videoElement = document.createElement("video-js");
            videoElement.classList.add("vjs-big-play-centered");
            videoRef.current.appendChild(videoElement);

            const player = (playerRef.current = videojs(videoElement, options, () => {
                videojs.log("player is ready");
                if (onReady) onReady(player);
            }));

            // Attach our custom error handler
            if (onError) {
                player.on("error", () => {
                    onError(player.error());
                });
            }
        } else {
            // Update player dynamically if options change
            const player = playerRef.current;
            player.autoplay(options.autoplay);
            
            // Prevent video reloading loops if App.jsx re-renders
            const currentSrc = player.currentSrc();
            const newSrc = options.sources?.[0]?.src;
            
            if (newSrc && currentSrc !== newSrc) {
                player.src(options.sources);
            }
        }
    }, [options, videoRef, onReady, onError]);

    // Dispose the Video.js player when the functional component unmounts
    useEffect(() => {
        return () => {
            if (playerRef.current && !playerRef.current.isDisposed()) {
                playerRef.current.dispose();
                playerRef.current = null;
            }
        };
    }, []);

    return (
        <div data-vjs-player style={{ width: "90%", maxWidth: "1200px", maxHeight: "80vh", borderRadius: "8px", overflow: "hidden", backgroundColor: "#000" }}>
            <div ref={videoRef} />
        </div>
    );
};

export default VideoPlayer;