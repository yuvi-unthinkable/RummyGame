import { Image, useImage } from "@shopify/react-native-skia";
import React from "react";
import { View } from "react-native";

type CardProps = {
  source: string;
};

const Card = ({ source }: CardProps) => {
  const width = 20;
  const height = 40;
  const color = "#fff";

  const bg = useImage(require(source));

  return (
    <View style={{ height, width }}>
      {bg && <Image image={bg} height={height} width={width} />}
    </View>
  );
};

export default Card;
