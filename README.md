# A bug-free version of react-loadable

Check the old readme [here](https://github.com/jamiebuilds/react-loadable).

New package name: `@tranvansang/react-loadable`.

# Background

There is a bug in the original `react-loadable` package in which its webpack plugin only loads required files from the including chunk.

While it should load all files from the required chunk group**s** (notice the plural).

Note: a chunk group is a group of chunks, which contains one or several chunks.
