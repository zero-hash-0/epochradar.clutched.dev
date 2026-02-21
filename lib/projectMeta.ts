export type ProjectMeta = {
  symbol: string;
  iconUrl: string;
};

const FALLBACK_ICON = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png";

const PROJECT_META: Record<string, ProjectMeta> = {
  "Jupiter Exchange": {
    symbol: "JUP",
    iconUrl: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png",
  },
  "Drift Protocol": {
    symbol: "DRIFT",
    iconUrl: "https://assets.coingecko.com/coins/images/35305/standard/drift.png",
  },
  "Kamino Finance": {
    symbol: "KMNO",
    iconUrl: "https://assets.coingecko.com/coins/images/36759/standard/kmno.jpg",
  },
  "Magic Eden Rewards": {
    symbol: "ME",
    iconUrl: "https://assets.coingecko.com/coins/images/36331/standard/me.jpg",
  },
  "Tensor NFT": {
    symbol: "TNSR",
    iconUrl: "https://assets.coingecko.com/coins/images/36008/standard/tensor.jpg",
  },
  "Raydium LP Rewards": {
    symbol: "RAY",
    iconUrl: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
  },
  "Pyth Network": {
    symbol: "PYTH",
    iconUrl: "https://assets.coingecko.com/coins/images/31924/standard/pyth.png",
  },
};

export function getProjectMeta(project: string): ProjectMeta {
  return PROJECT_META[project] || {
    symbol: project.slice(0, 4).toUpperCase(),
    iconUrl: FALLBACK_ICON,
  };
}
