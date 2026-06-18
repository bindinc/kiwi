# Kiwi documentation index

Use this folder as the entry point for durable Kiwi documentation. Keep new file
and folder names lower-kebab-case so paths stay readable in commits, links, and
automation output.

## How-to guides

Use `how-to/` for task-oriented instructions that help a developer or operator
complete a concrete workflow.

- [Run the Docker Compose and Playwright test workflow](how-to/compose-playwright-test-workflow.md)
- [Work with branches and collaboration rules](how-to/branching.md)
- [Simulate Avaya calls](how-to/simulate-avaya-calls.md)

## Reference

Use `reference/` for contracts, conventions, matrices, and other material that
must be looked up precisely.

- [Action router conventions](reference/action-router-conventions.md)
- [Symfony migration contract matrix](reference/symfony-migration-contract-matrix.md)

## Explanation

Use `explanation/` for design background, tradeoffs, follow-up notes, and feature
context that explain why Kiwi works the way it does.

- [Cluster follow-up](explanation/cluster-follow-up.md)
- [Coupon code and discount improvements](explanation/coupon-code-feature.md)

## Tutorials

Add a `tutorials/` folder only when there is a real learning path that takes a
new contributor from a clean start to a working outcome. Do not put ordinary
task instructions there; use `how-to/` for those.
