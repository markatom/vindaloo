// @flow

const normalizeResource = (separator: string, resource: string): string => {
    return resource
        .split(separator)
        .filter((part) => part.length > 0)
        .join(separator);
};

export default normalizeResource;
