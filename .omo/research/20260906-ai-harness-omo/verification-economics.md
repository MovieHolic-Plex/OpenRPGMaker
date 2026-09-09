# Verification decisions

| Claim | Error cost | Chosen proof | Outcome / residual limit |
|---|---|---|---|
| C01 platform baseline | High: wrong architecture imported | Installed package read + checkout git/filesystem probe | Baseline established; docs may be stale |
| C02 proof-complete wording | High: plan centered on nonexistent bug | Read method and return-kind contract, then execute actual method body with isolated outcomes | E02 confirms failed/cancelled misleading marker; no live outage claimed |
| C03 text classification | Low for narrow claim | Read types and classifier | Supported; no extrapolation to all state |
| C04 historical reuse intent | Low | Dated spec read | Supported only as dated intent |
| C05 OMO hard evidence guarantee | High: copy weaker contract as stronger one | Installed pure functions independently run by lead | E01 disproves blanket guarantee |
| C07 duplicate replay | High: unsafe auto-resume design | Exact selector/send path + record schema | Path risk confirmed; no live DB duplicate needed for plan |
| C09 existing evidence gates | High: duplicate domain model | Read implementation and matching integration test assertions | Existing mechanism preserved |
| C12 stale proposal policy | High: hidden behavior change | Read test with explicit overwrite assertion | Declare deliberate policy decision in plan |
