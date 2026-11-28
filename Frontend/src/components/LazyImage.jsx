import { useState } from "react";
import PropTypes from "prop-types";
import "./LazyImage.css"; // Import the CSS file

const LazyImage = ({ src, alt, className = "", ...props }) => {
  const [isBlurred, setIsBlurred] = useState(true);

  return (
    <div className={` ${className}`} style={{ position: "relative", overflow: "hidden" }}>
      <img
        src={src}
        alt={alt}
        className={` ${isBlurred ? "blurred" : ""}`}
        loading="lazy"
        onLoad={() => setIsBlurred(false)}
        style={{
          borderRadius: "0.5rem",
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
