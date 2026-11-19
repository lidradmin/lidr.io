module.exports = {
  ci: {
    collect: {
      staticDistDir: "./out",
      url: [
        "/",
        "/about/",
        "/features/",
        "/pricing/",
        "/contact-us/",
        "/blog/",
        "/blog/photo-reports-that-hold-up/",
      ],
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.7 }],
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
        "categories:seo": ["error", { minScore: 1 }],
      },
    },
  },
};
