// Timestamp-preservation rule shared by the two outputs of
// scripts/build-data.mjs: the model snapshot and the integrity manifest both
// stamp `generatedAt`, and a rebuild that changes nothing substantive must
// keep the previous stamp so the file stays byte-identical and the weekly
// refresh workflow has no diff to open a PR for.
//
// `path` locates the timestamp field inside the document:
//   ["generatedAt"]          for the integrity manifest
//   ["meta", "generatedAt"]  for the model snapshot

/**
 * Copy `previous`'s timestamp onto `current` when both documents are
 * identical once the timestamp at `path` is ignored.
 *
 * @param {object} current  freshly built document; mutated in place on success
 * @param {object|null} previous  previously persisted document, or null
 * @param {string[]} path  keys leading to the `generatedAt` field
 * @returns {boolean} true when the previous timestamp was reused, false when
 * the content changed or `previous` carries no stamp
 */
export function preservePreviousTimestamp(current, previous, path) {
    const read = (doc) => path.reduce((value, key) => value?.[key], doc);
    const previousTimestamp = read(previous);
    if (!previousTimestamp) return false;

    const withoutTimestamp = (doc) => {
        const clone = structuredClone(doc);
        let container = clone;
        for (const key of path.slice(0, -1)) container = container?.[key];
        if (container) container[path[path.length - 1]] = null;
        return JSON.stringify(clone);
    };

    if (withoutTimestamp(previous) !== withoutTimestamp(current)) return false;

    let container = current;
    for (const key of path.slice(0, -1)) container = container?.[key];
    container[path[path.length - 1]] = previousTimestamp;
    return true;
}
