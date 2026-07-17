module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:4173/",
        "http://localhost:4173/about/",
        "http://localhost:4173/pricing/",
      ],
      numberOfRuns: 1,
      startServerCommand: "npx serve out -l 4173",
      startServerReadyPattern: "Accepting connections",
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.7 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
