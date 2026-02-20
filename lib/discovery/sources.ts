export type DiscoverySource = {
  id: string;
  name: string;
  kind: "rss";
  url: string;
  weight: number;
};

export const DISCOVERY_SOURCES: DiscoverySource[] = [
  {
    id: "solana-news",
    name: "Solana News",
    kind: "rss",
    url: "https://solana.com/news/feed",
    weight: 1.0,
  },
  {
    id: "jupiter-blog",
    name: "Jupiter Blog",
    kind: "rss",
    url: "https://station.jup.ag/feed",
    weight: 1.0,
  },
  {
    id: "helius-blog",
    name: "Helius Blog",
    kind: "rss",
    url: "https://www.helius.dev/blog/rss.xml",
    weight: 0.9,
  },
  {
    id: "drift-blog",
    name: "Drift Blog",
    kind: "rss",
    url: "https://www.drift.trade/blog/rss.xml",
    weight: 0.9,
  },
  {
    id: "tensor-blog",
    name: "Tensor Blog",
    kind: "rss",
    url: "https://www.tensor.trade/blog/rss.xml",
    weight: 0.85,
  },
];
