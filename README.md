# GitHub Blocks Template

> 📣 Use this repository as a starter project if you're a GitHub user interested in building your own custom Blocks!

This template is (built with [Vite](https://vitejs.dev/), [React](https://reactjs.org/) and [Typescript](https://www.typescriptlang.org/)) and we'll guide you through how to use it.

Here's a short tutorial video on how to get started creating your own block:

[Tutorial Video](https://user-images.githubusercontent.com/8978670/156399836-96acfff1-e44d-4047-b508-6e3e4e83f68c.mp4)

Here's a short tutorial video on the Blocks API:

[Blocks API](https://user-images.githubusercontent.com/8978670/156633540-64d90ce8-9df6-48ce-98ee-6d99a796227a.mp4)

## Setup

This repo is already a template! To use it just click on the "Use this template" button on the top right to set it up for your use.

<img width="495" alt="Screen Shot 2021-12-06 at 12 29 29 PM" src="https://user-images.githubusercontent.com/8978670/144893319-5d45ab5c-12c0-42b4-99f8-97f658deb03b.png" />

The button will take you to a screen to specify what you want to name your own repo.

<img width="801" alt="Screen Shot 2021-12-06 at 12 29 17 PM" src="https://user-images.githubusercontent.com/8978670/144893351-25b24bfa-3400-4e92-9a2a-618b3ac06a5e.png" />

## Step 1. Develop locally

```bash
yarn # install dependencies
yarn start # start the dev server
```

A development server should now be running on [localhost:4000](localhost:4000).

## Step 2. View your Blocks within a sandbox

When you visit [localhost:4000](localhost:4000) in your browser, you should see an interface which we'll call a "sandbox" that lets you test out local and production versions of your Block.

This starter project has one example folder block and one example file block.

[Sandbox video](https://user-images.githubusercontent.com/8978670/144666304-b9012177-aed6-4c26-afc3-3de8c8d6d0ad.mov)

You can play with two bits of the interface to view your Blocks:

1. **Input file or folder**: An `input` that accepts the direct path to a file or a folder on github.com. Here are some valid file/folder paths.

- https://github.com/facebook/react/blob/main/README.md (file)
- https://github.com/facebook/react/blob/0.3-stable/README.md (file)
- https://github.com/facebook/react/blob/main/packages/react-dom/index.js (file)
- https://github.com/facebook/react/ (folder)
- https://github.com/facebook/react/tree/0.3-stable (folder)
- https://github.com/facebook/react/tree/main/packages (folder)

2. **List of custom blocks**: A `select` that lists out the contents of the array that you have defined in `/blocks.config.json`.

Once you've entered a valid path, choose from the different block types and the content should be rendered beneath. Be sure to check your console for errors if you think something has broken!

## Step 3. Customize or build your own Blocks with the GitHub Blocks API

To create or customize your own custom blocks you need to do two things:

### Step 3.1: Define your custom block

If you open up `/blocks.config.json`, you'll notice an array of block objects with the definitions for each custom block. It looks like this:

```ts
interface BlockDefinition {
  type: "file" | "folder";
  id: string;
  title: string;
  description: string;
  entry: string;
  extensions: string[]; // Soon to be deprecated in favor of the following "matches" key.
  matches?: string[]; // An array of globs written in picomatch syntax. See https://github.com/micromatch/picomatch for examples.
  example_path?: string;
}
```

You have to define these properties for your own custom Block.

From top to bottom:

- `type` determines whether this block applies to, well, files or folders.
- `id` is the identifier string for this block: this needs to be unique within your project. GitHub Blocks uses this to determine which block to render.
- `title` and `description` are both presentational attributes that affect how the block will appear on the [Blocks Marketplace](https://blocks-marketplace.githubnext.com/)
- `entry` is the most important attribute: its value should be a file path to your block's entry point (starting with `/` - the root)
- `extensions` is an array of file extensions (the text of a filename _after_ the first `.`), which lets GitHub Blocks know for which types of files this block should be listed. `*` represents a wildcard value, meaning the block will always be listed.
- `matches` is an array of globs (following https://github.com/micromatch/picomatch syntax), which lets GitHub Blocks know for which types of files this block should be listed.
- `example_path` (optional) is the path to an example file that will be displayed in the block’s preview on the [Blocks Marketplace](https://blocks-marketplace.githubnext.com/).

### Step 3.2: Code your Block

Most of your code will go within: `blocks/`.

This is where you'll find our two example blocks.

#### GitHub Blocks API

A Block is a React component that receives a special set of props and returns JSX. We've implemented two type of Blocks: File Blocks and Folder Blocks. Their API is largely the same, receiving the following props:

```ts
interface BlockProps {
  block: {
    id: string;
    type: string;
    title: string;
    description: string;
    entry: string;
    extensions?: string[];
    matches?: string[];
  };
  context: {
    path: string;
    file: string;
    repo: string;
    owner: string;
    sha: string;
  };
  metadata: any;

  // whether or not a user can edit the content
  // for example, this will be false if they only have read access to the repo
  isEditable: boolean;

  // callback functions
  onUpdateMetadata: (
    newMetadata: any,
    path: string,
    block: Block,
    currentMetadata: any
  ) => void;
  onUpdateContent: (newContent: string) => void;
  onRequestGitHubData: (
    // this is any GET endpoint in the GitHub API:
    // https://docs.github.com/en/rest/overview/endpoints-available-for-github-apps
    // e.g. `/repos/{owner}/{repo}/contributors`
    path: string,
    params: Record<string, any>
  ) => Promise<any>;
  onNavigateToPath: (path: string) => void;

  // if a File Block
  content: string;

  // if a Folder Block
  tree: {
    path?: string;
    mode?: string;
    type?: string;
    sha?: string;
    size?: number;
    url?: string;
  }[];
}
```

For simple use cases, the `content` (the content of the file) or `tree` (a list of the contained files & folders) prop will be the most useful, with info about the file or folder the user is looking at on the GitHub Blocks UI. But if you need additional context (such as the path to the file or the owner/repo in which the file lives), you can access it via the handy `context` prop.

`metadata` is a free-form prop that can be used to store arbitrary data about the file. It's up to you to decide what you want to store in this object: anywhere from definitions of data visualizations in a charts Block to annotations for a code Block. This is unique per file/folder per Block and stored within a [`.github/blocks/file/`](https://github.com/githubnext/blocks-tutorial/tree/main/.github/blocks) folder within the viewed repo. To update the metadata, you can call the `onUpdateMetadata` prop with the updated data, which creates a new commit on the repo.

A few caveats and callouts:

- Blocks have access to [GitHub Primer React components](https://primer.style/react/)
- You can use both third-party _and_ relative imports in your Block code! Simply put, feel free to install any dependencies from NPM, or import a local JS/CSS file and it should be included in the final bundle.
- Your Block entry file **must have the Block component as its default export**. If it does not, bad things will happen.
- To make authenticated requests to the GitHub API, create a [personal access token](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line) (with `repo` scope) and pass it when you start the dev server:

```
VITE_GITHUB_PAT=${your personal access token} yarn dev
```

or put it in your [`.env`](https://vitejs.dev/guide/env-and-mode.html#env-files) file in the project root directory.

##### Relevant repos

[Blocks examples](https://github.com/githubnext/blocks-examples)

Example blocks that we've built to showcase the API.

[Blocks utility library](https://github.com/githubnext/utils)

To reduce the cognitive load associated with writing file and folder Block components, we've assembled a helper library called `@githunext/utils` that exposes interface definitions and a few helper functions. This list will undoubtedly change over time, so be sure to check out [the repository page](https://github.com/githubnext/utils) for more detail.

## Step 4. Deploy your Blocks to production

We've built a [Blocks Marketplace](https://blocks-marketplace.githubnext.com/) where anyone can find and use your Blocks!

In order to include your custom blocks within that marketplace you have to do a few things:

### Step 4.1: Add the topic `github-blocks` to your repo

You need to tag this repository with the topic `github-blocks` so we can find your repository.

<img width="323" alt="Screen Shot 2021-12-03 at 2 54 55 PM" src="https://user-images.githubusercontent.com/8978670/144665902-63543c98-2486-4e13-9c54-f1d4bc6544a4.png" />

### Step 4.2: Push a new tag

To build a production version of your app, we've included a build system within this template that handles everything for you (a combination of GitHub actions within the `.github/workflows` folder and a `build.ts` script).

Don't worry! We deal with a lot of this complexity, all you have to do is create a new tag to kick-start the build process.

```bash
git tag 0.9.0 # Create a new tag with your own version number
git push --tags # Push the tag to GitHub
```

### Step 4.3: Wait for the build process to finish

Pushing a new tag should kick-start a GitHub action that builds your relase. Wait for that to finish and find a release with your same tag number.

From the repository settings page, make sure that your workflow have **Read and write** permissions or the action will fail with a 403 error.

<img width="805" alt="Screen Shot 2022-05-11 at 8 14 06 AM" src="https://user-images.githubusercontent.com/5148596/167847856-22ad190a-d73c-4b97-a0e2-c3c854db0d4f.png">

<img width="1097" alt="Screen Shot 2021-12-03 at 3 03 33 PM" src="https://user-images.githubusercontent.com/8978670/144665796-cb1ff450-c872-47c5-90b3-f74aea10286b.png" />

<img width="152" alt="Screen Shot 2021-12-03 at 3 02 10 PM" src="https://user-images.githubusercontent.com/8978670/144665673-431e28f9-9e9d-43b3-87f8-1e5d98bed92c.png" />

### Step 4.4: Make sure your repo is public

We can only detect Blocks in public repos!

### Step 4.5: Wait for the Marketplace to find your Blocks

Every hour we search GitHub for new custom Blocks. Wait about an hour before you can see your blocks on the [Blocks Marketplace](https://blocks-marketplace.githubnext.com/).

## Troubleshooting

- When developing folder blocks you might hit a "Something went wrong" message if you reach the rate limit of the GitHub API. This is because we're hitting the API unauthenticated.
