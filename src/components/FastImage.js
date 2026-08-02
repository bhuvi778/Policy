import React, { useState } from 'react';
import { Image, View } from 'react-native';

const FastImage = React.memo(({
  source,
  resizeMode = 'cover',
  priority = 'normal',
  style,
  ...props
}) => {
  const [failed, setFailed] = useState(false);
  const normalizedSource =
    typeof source === 'string'
      ? { uri: source, cache: 'force-cache' }
      : source?.uri
        ? { ...source, cache: source.cache || 'force-cache' }
        : source;

  if (failed || !normalizedSource) {
    return <View style={style} />;
  }

  return (
    <Image
      {...props}
      source={normalizedSource}
      style={style}
      resizeMode={resizeMode}
      resizeMethod="resize"
      progressiveRenderingEnabled
      fadeDuration={120}
      onError={(event) => {
        setFailed(true);
        props.onError?.(event);
      }}
    />
  );
});

export default FastImage;
