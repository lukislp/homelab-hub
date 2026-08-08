## [1.2.1](https://github.com/lukislp/homelab-hub/compare/v1.2.0...v1.2.1) (2026-08-08)


### Bug Fixes

* bump nanoid to close a high-severity npm audit finding ([974f44e](https://github.com/lukislp/homelab-hub/commit/974f44e8887058430e061874c67a64ad37c0b257)), closes [hi#severity](https://github.com/hi/issues/severity)
* copy the whole server/ directory into the runtime image ([45d2c79](https://github.com/lukislp/homelab-hub/commit/45d2c79d994d842a514b5ffe12994af8470cd557))

# [1.2.0](https://github.com/lukislp/homelab-hub/compare/v1.1.3...v1.2.0) (2026-08-07)


### Bug Fixes

* close remaining gaps to reach 100% coverage on the scoped test surface ([52b2f05](https://github.com/lukislp/homelab-hub/commit/52b2f05dd842d2d76176614e66ae2ffb60c7ef23))
* re-trigger CI after the previous push's webhook was dropped during a GitHub Actions incident ([3971b68](https://github.com/lukislp/homelab-hub/commit/3971b6852a32cc8d4d9e400b2a134f3127a6cc7e))
* self-heal a stale npm cache instead of failing the build outright ([c8789d6](https://github.com/lukislp/homelab-hub/commit/c8789d6012a3f6a49f314859f2203249ceea7735))


### Features

* add vitest unit tests and self-hosted coverage badge ([a5c25fb](https://github.com/lukislp/homelab-hub/commit/a5c25fb3c1a41bb1a18a8a97f05ae8a6376bd20d))

## [1.1.3](https://github.com/lukislp/homelab-hub/compare/v1.1.2...v1.1.3) (2026-08-05)


### Bug Fixes

* add a dashboard screenshot to the README ([66775c1](https://github.com/lukislp/homelab-hub/commit/66775c1228a4eb1f288b743915a8b8186fa82d42))

## [1.1.2](https://github.com/lukislp/homelab-hub/compare/v1.1.1...v1.1.2) (2026-08-05)


### Bug Fixes

* eliminate the empty-looking first second of page load ([d633b66](https://github.com/lukislp/homelab-hub/commit/d633b66b05c1f4dee742aa876dc4588d561d9322))

## [1.1.1](https://github.com/lukislp/homelab-hub/compare/v1.1.0...v1.1.1) (2026-08-05)


### Bug Fixes

* trigger a release for the public demo mode and README link ([3fba74d](https://github.com/lukislp/homelab-hub/commit/3fba74d3044b9e43595b93a678aa63e67929bf17))

# [1.1.0](https://github.com/lukislp/homelab-hub/compare/v1.0.1...v1.1.0) (2026-08-05)


### Features

* add a READ_ONLY mode for public demo deployments ([10a5098](https://github.com/lukislp/homelab-hub/commit/10a5098e60d8ad661c431af5cb198f60bdebbc0d))

## [1.0.1](https://github.com/lukislp/homelab-hub/compare/v1.0.0...v1.0.1) (2026-08-05)


### Bug Fixes

* surface build/release/license status via README badges ([211ca48](https://github.com/lukislp/homelab-hub/commit/211ca4812c3322bf1b3f7d6f3e57f0db99bfbe87))

# 1.0.0 (2026-08-04)


### Bug Fixes

* kubeconform failing on CRDs without a published schema ([912c759](https://github.com/lukislp/homelab-hub/commit/912c759f5eaa2992f7863496d1847d33fe99cedd))
