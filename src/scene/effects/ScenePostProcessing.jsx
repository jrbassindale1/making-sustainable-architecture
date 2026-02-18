import { Bloom, EffectComposer, SSAO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";

export function ScenePostProcessing({ sunFactor, captureMode }) {
  return (
    <EffectComposer multisampling={captureMode ? 2 : 4} enableNormalPass>
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={captureMode ? 8 : 14}
        radius={0.085}
        intensity={15}
        luminanceInfluence={0.25}
        color="black"
      />
      <Bloom
        blendFunction={BlendFunction.SCREEN}
        mipmapBlur
        luminanceThreshold={0.82}
        luminanceSmoothing={0.2}
        intensity={0.14 + sunFactor * 0.3}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.22} darkness={0.33} />
    </EffectComposer>
  );
}
