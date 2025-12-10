import * as bitecs from 'bitecs';

const b = bitecs.default || bitecs;
const world = b.createWorld();
const Comp = b.registerComponent(world, { x: 'f32' });
const eid = b.addEntity(world);
// Try to add component?
b.addComponent(world, Comp, eid);

console.log('World keys:', Object.keys(world));
// Check if world has storage?
if (world.components) console.log('World has components');

// Register Query
const q = b.registerQuery(world, [Comp]);
console.log('Query object:', q);

// Run Query?
if (b.query) {
    const res = b.query(world, q);
    console.log('b.query(world, q) returned:', res);
}
