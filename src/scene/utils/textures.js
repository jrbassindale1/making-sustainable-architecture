import { RepeatWrapping, SRGBColorSpace } from "three";

export function configureTexture(texture, repeat, useSrgb = false) {
  if (!texture) return;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 8;
  if (useSrgb) texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
}
