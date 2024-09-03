import React, { useState, useRef } from 'react';
import { Badge, Overlay, Tooltip } from 'react-bootstrap';

function NFTBadge({ nft, onClick, bg }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const target = useRef(null);

  return (
    <>
      <Badge
        ref={target}
        bg={bg}
        className="me-2 mb-2"
        style={{ cursor: 'pointer' }}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {nft.metadata.name} ✕
      </Badge>

      <Overlay target={target.current} show={showTooltip} placement="top">
        {(props) => (
          <Tooltip id={`tooltip-${nft.id}`} {...props}>
            <img 
              src={nft.metadata.image} 
              alt={nft.metadata.name} 
              style={{ maxWidth: '150px', maxHeight: '150px' }} 
            />
          </Tooltip>
        )}
      </Overlay>
    </>
  );
}

export default NFTBadge;
