import NodeCache from "node-cache";

const cache = new NodeCache();

export const cacheMiddleware = (ttl = 10) => {
  return (req, res, next) => {
    const key = req.originalUrl + (req.user ? `_${req._id}` : "");

    const cached = cache.get(key);
    if (cached) {
      return res.json(cached);
    }

    const originalJson = res.json.bind(res);

    res.json = (data) => {
      cache.set(key, data, ttl);
      return originalJson(data);
    };

    next();
  };
};
