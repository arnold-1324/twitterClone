import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

const LazyImage = ({ src, alt, className = "", ...props }) => {
  const [isBlurred, setIsBlurred] = useState(true);

  const handleLoad = useCallback(() => {
    // Remove blur after 3 seconds
    setTimeout(() => {
      setIsBlurred(false);
    }, 2000);
  }, []);

  return (
    <div className={`lazy-image-wrapper ${className}`} style={{ position: "relative", overflow: "hidden" }}>
      <img
        src={src}
        alt={alt}
        className={`lazy-image ${isBlurred ? "blurred" : ""}`}
        onLoad={handleLoad}
        style={{
          width: "100%",
          height: "auto",
          filter: isBlurred ? "blur(10px)" : "none",
          transition: "filter 0.3s ease",
        }}
        {...props}
      />
    </div>
  );
};

LazyImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default LazyImage;
