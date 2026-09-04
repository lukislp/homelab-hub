## [1.4.6](https://github.com/lukislp/homelab-hub/compare/v1.4.5...v1.4.6) (2026-09-04)


### Bug Fixes

* **deps:** bump lucide-react from 1.38.0 to 1.39.0 ([b920947](https://github.com/lukislp/homelab-hub/commit/b920947d78864e3f5b4e491108a6bf400a514d1b))

## [1.4.5](https://github.com/lukislp/homelab-hub/compare/v1.4.4...v1.4.5) (2026-09-04)


### Bug Fixes

* **deps:** bump @types/node from 26.4.0 to 26.4.1 in the dev group ([0ed4d7d](https://github.com/lukislp/homelab-hub/commit/0ed4d7d834921eebe59090ced6d476501f2e2f14))

## [1.4.4](https://github.com/lukislp/homelab-hub/compare/v1.4.3...v1.4.4) (2026-09-04)


### Bug Fixes

* **ci:** ignore base image major bumps in Dependabot ([8f6e6ef](https://github.com/lukislp/homelab-hub/commit/8f6e6ef0bbba5af1301a5b74249c9535629768f0))

## [1.4.3](https://github.com/lukislp/homelab-hub/compare/v1.4.2...v1.4.3) (2026-09-04)


### Bug Fixes

* **deps:** bump motion from 12.42.2 to 13.1.1 ([e95d38f](https://github.com/lukislp/homelab-hub/commit/e95d38ff21e6f51e35e44c2c684273bfc4cb8246))

## [1.4.2](https://github.com/lukislp/homelab-hub/compare/v1.4.1...v1.4.2) (2026-09-04)


### Bug Fixes

* **ci:** bump aquasecurity/trivy-action ([144cc73](https://github.com/lukislp/homelab-hub/commit/144cc73bd9e36e3aedf71c4aa848c920dd6a938a))
* **ci:** bump docker/setup-buildx-action from 4.2.0 to 4.3.0 ([cfcd209](https://github.com/lukislp/homelab-hub/commit/cfcd209ea4862481c1dbfb70f9d26d04b137e844))
* **deps:** bump lucide-react from 1.26.0 to 1.38.0 ([fe2d492](https://github.com/lukislp/homelab-hub/commit/fe2d49253e962c6d0a24f2824e2ea09f29d05621))
* **deps:** bump the dev group with 10 updates ([62cc981](https://github.com/lukislp/homelab-hub/commit/62cc9811171501100eab9e7686f7da9b56fa8e80))
* **deps:** bump zustand from 5.0.14 to 5.0.15 ([f378dd7](https://github.com/lukislp/homelab-hub/commit/f378dd795d083007ea051e76930975f3534eddf4))
* **deps:** sync lockfile after batch merge ([ee8b482](https://github.com/lukislp/homelab-hub/commit/ee8b482adec8353bb50a2e78208ebf1d2d918fb1))

## [1.4.1](https://github.com/lukislp/homelab-hub/compare/v1.4.0...v1.4.1) (2026-09-03)


### Bug Fixes

* **ci:** add Dependabot for github-actions, npm, docker ([22fbbbd](https://github.com/lukislp/homelab-hub/commit/22fbbbdc43e9cd24e21942bafb68c03e2f0491db))

# [1.4.0](https://github.com/lukislp/homelab-hub/compare/v1.3.2...v1.4.0) (2026-08-25)


### Bug Fixes

* update CI validation and docs for the Longhorn storageClassName ([40be347](https://github.com/lukislp/homelab-hub/commit/40be3475a3f6fb6bbf7e8aa2979485aced44477b)), closes [#7](https://github.com/lukislp/homelab-hub/issues/7)


### Features

* move data volume to Longhorn for cross-node replication ([2f30d87](https://github.com/lukislp/homelab-hub/commit/2f30d8701b7668dd0dc009d306c2206762fc96ef))

## [1.3.2](https://github.com/lukislp/homelab-hub/compare/v1.3.1...v1.3.2) (2026-08-24)


### Bug Fixes

* **docker:** exclude .github from the build context ([dc02eea](https://github.com/lukislp/homelab-hub/commit/dc02eea3d82285aacb3b8df75c803ad5fa18846e))

## [1.3.1](https://github.com/lukislp/homelab-hub/compare/v1.3.0...v1.3.1) (2026-08-24)


### Performance Improvements

* **ci:** native per-arch docker builds instead of QEMU emulation ([dd39996](https://github.com/lukislp/homelab-hub/commit/dd39996ad934713f98e844afa8f701046351710a))

# [1.3.0](https://github.com/lukislp/homelab-hub/compare/v1.2.2...v1.3.0) (2026-08-24)


### Bug Fixes

* **k8s:** opt the data volume into the nightly Velero backup ([bc240d4](https://github.com/lukislp/homelab-hub/commit/bc240d4dd656316462b61d22acf3e05529666576))
* **scripts:** teach the kustomization sync check the bootstrap/flux split ([87c144b](https://github.com/lukislp/homelab-hub/commit/87c144b5f00f3e86ff279a8513dd1ec9b09b2503))


### Features

* **k8s:** Flux onboarding - GitOps deploy + image automation ([bab9271](https://github.com/lukislp/homelab-hub/commit/bab92711cba7c6ff5771dc839145e46839011983))

## [1.2.2](https://github.com/lukislp/homelab-hub/compare/v1.2.1...v1.2.2) (2026-08-24)


### Bug Fixes

* **k8s:** real cluster values, GHCR-pinned image, cpu limit, NetworkPolicies ([484825b](https://github.com/lukislp/homelab-hub/commit/484825b964de2fd5b5f90ff04fef65cc8a51f799))

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
