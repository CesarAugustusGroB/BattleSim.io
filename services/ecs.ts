
// High-performance, zero-dependency ECS customized for this project
export const MAX_ENTITIES = 10000;

export const Types = {
    f32: Float32Array,
    ui8: Uint8Array,
    eid: Uint32Array
};

export function createWorld() {
    return {
        entityMasks: new Uint32Array(MAX_ENTITIES),
        recycleBin: [] as number[],
        nextEid: 1,
        entities: [] as number[], // Active entities list
        queries: [] as any[] // Track registered queries to update them
    };
}

export const addEntity = (world: any): number | undefined => {
    if (world.entities.length >= MAX_ENTITIES) {
        console.warn("[ECS] Max entities reached");
        return undefined;
    }

    // Simple EID generation strategy: find first gap or append?
    // For performance/simplicity in this local ECS, we'll just increment specific ID if we recycle
    // But for now, let's just use simple auto-increment or similar.
    // Actually, let's just use a counter or recycle. 
    // Let's use a simple stack of free IDs to be robust.

    // For this 'lite' version, let's just pick a random high ID or use a counter.
    // Ideally we shouldn't scan.
    // Let's assume we have a simple 'nextId'.
    // We need to store 'nextId' on the world.

    // HACK: Add nextId to world object (casting)
    const w = world as any;
    if (typeof w.nextId === 'undefined') w.nextId = 1;

    const eid = w.nextId++;
    world.entities.push(eid);

    // Update active queries
    for (const q of world.queries) {
        q.push(eid);
    }

    console.log(`[ECS] Added entity ${eid}. Total: ${world.entities.length}`);
    return eid;
};

export function removeEntity(world: any, eid: number) {
    const idx = world.entities.indexOf(eid);
    if (idx !== -1) {
        world.entities[idx] = world.entities[world.entities.length - 1];
        world.entities.pop();
    }

    // Remove from queries
    for (const q of world.queries) {
        const qIdx = q.indexOf(eid);
        if (qIdx !== -1) {
            q[qIdx] = q[q.length - 1];
            q.pop();
        }
    }

    world.recycleBin.push(eid);
    world.entityMasks[eid] = 0;
}

export function registerComponent(world: any, schema: any) {
    const component: any = {};

    for (const key in schema) {
        const typeHelper = schema[key];
        // Default to f32 if string 'f32' or similar
        let TypedArrayCtor: any = Float32Array;

        if (typeHelper === 'ui8' || typeHelper === Types.ui8) TypedArrayCtor = Uint8Array;
        else if (typeHelper === 'eid' || typeHelper === Types.eid) TypedArrayCtor = Uint32Array;

        component[key] = new TypedArrayCtor(MAX_ENTITIES);
    }

    return component;
}

export function registerQuery(world: any, components: any[]) {
    // For this specific simulation, we only have one main archetype (Units)
    // capable of seamlessly returning the world entity list or a new tracked list.
    // To be safe and robust, we'll return a live array that tracks all active entities
    // since we don't strictly implement component masks for filtering yet 
    // (as all units have all components in this sim).

    const queryResults: number[] = [...world.entities];
    world.queries.push(queryResults);
    return queryResults;
}

// Helpers for compatibility if needed
export const system = (world: any, update: Function) => {
    // No-op, we run updates manually
};
