import { useMemo } from 'react';
import '@react-three/fiber';
import { VoxelBatch } from './VoxelBatch';
import { buildVillage } from './villageBuilder';
import { Boat, Sign, Banner } from './Models';
import { Glows } from './Glows';

export const Island = ({lite=false}) => {
  const village=useMemo(buildVillage,[]);
  const [px,pz]=village.plaza;
  return <group>
    <VoxelBatch blocks={village.blocks} lite={lite}/><VoxelBatch blocks={village.lights} emissive/>
    <Glows lamps={village.lamps} lights={!lite}/>
    <Sign position={[.4,1.75,3.22]} text="FISH MARKET"/>
    <Sign position={[1.7,2.4,-.4]} text="FROSTFISH INN"/>
    <Sign position={[8.8,1.02,11.3]} text="HARBOR"/>
    <Sign position={[-2.5,1.02,-6.9]} text="FROSTHAVEN"/>
    <Banner position={[px,3.6,pz+1.8]} text="ROBINHOOD"/>
    <Boat position={[11.1,.18,14.2]} rotation={[0,Math.PI/2,0]} scale={1.05}/>
    <Boat position={[14.3,.17,15.3]} rotation={[0,-.12,0]} scale={.8}/>
  </group>;
};
