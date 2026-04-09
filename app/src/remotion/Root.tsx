import { Composition } from 'remotion'
import { HelloComposition } from './compositions/HelloComposition'

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HelloComposition"
        component={HelloComposition}
        durationInFrames={150}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  )
}
