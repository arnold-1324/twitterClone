import React, { useRef } from 'react';
import Draggable from 'react-draggable';
import { Input, Box } from '@chakra-ui/react';

const DraggableText = ({ text, onUpdate, onDelete, fontSize, fontColor, bgColor }) => {
  const nodeRef = useRef(null);

  const handleDrag = (e, data) => {
    e.preventDefault();
    onUpdate(text.id, { 
      x: Math.round(data.x), 
      y: Math.round(data.y) 
    });
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      bounds="parent"
      defaultPosition={{ x: text.x || 0, y: text.y || 0 }}
      onStop={handleDrag}
      position={null}
    >
      <Box
        ref={nodeRef}
        position="absolute"
        cursor="move"
        fontSize={`${fontSize || 16}px`}
        color={fontColor || '#000000'}
        bg={bgColor || 'transparent'}
        px={2}
        py={1}
        borderRadius="md"
        onDoubleClick={() => onDelete(text.id)}
        userSelect="none"
      >
        <Input
          variant="unstyled"
          value={text.content}
          onChange={(e) => onUpdate(text.id, { content: e.target.value })}
          textAlign="center"
          color={fontColor || '#000000'}
          bg="transparent"
          _focus={{ outline: 'none' }}
          style={{ caretColor: fontColor || '#000000' }}
        />
      </Box>
    </Draggable>
  );
};

export default DraggableText;
