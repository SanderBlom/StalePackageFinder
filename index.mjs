import fs from 'fs/promises';

// Set month limit
let MONTHS_THRESHOLD = 36;

if (process.env.MONTHS_THRESHOLD > 0){
  MONTHS_THRESHOLD = process.env.MONTHS_THRESHOLD
}

/**
 * Reads and parses the `package.json` file in the current directory.
 * @returns {Promise<Object>} that resolves to the content of `package.json` as an object.
 * @throws Will throw an error if reading the file fails or the content cannot be parsed as JSON.
 */
async function readPackageJson() {
  try {
    const data = await fs.readFile('package.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading package.json:', error);
    process.exit(1);
  }
}

/**
 * Sorts an array of version strings in descending semantic order.
 * @param {string[]} versions - An array of version strings to sort.
 * @returns {string[]} The sorted array of version strings.
 */
function sortVersions(versions) {
  return versions.sort((a, b) => {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) { // Compare major, minor, patch
      if (partsA[i] > partsB[i]) return -1;
      if (partsA[i] < partsB[i]) return 1;
    }
    return 0; // Equal or identical
  });
}

/**
 * Fetches the last release time for a given npm package.
 * @param {string} packageName - The name of the package to check.
 * @returns {Promise<string|null>} A promise that resolves to the timestamp of the last release, or null if an error occurs.
 * @throws Will log an error if fetching data for the package fails.
 */
async function getLastReleaseTime(packageName) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    const data = await response.json();
    const versions = Object.keys(data.time).filter(version => /^(\d+\.)?(\d+\.)?(\*|\d+)$/.test(version));
    const sortedVersions = sortVersions(versions);
    const latestVersion = sortedVersions[0];
    return data.time[latestVersion];
  } catch (error) {
    console.error(`Failed to fetch data for package: ${packageName}`, error);
    return null;
  }
}

/**
 * Checks for package updates by reading the `package.json` file, determining the last release time of each dependency,
 * and outputting information in markdown format for packages not updated within the specified threshold.
 * @returns {Promise<void>} A promise that resolves when the check is complete and the results have been logged.
 */
async function checkPackageUpdates() {
  const packageJson = await readPackageJson();
  const dependencies = packageJson.dependencies ? Object.keys(packageJson.dependencies) : [];

  console.log(`Checking updates for ${dependencies.length} dependencies...\n`);

  let markdownOutput = dependencies.length > 0 ? "## Outdated Packages\n" : "No dependencies to check.";

  for (const packageName of dependencies) {
    const lastReleaseTime = await getLastReleaseTime(packageName);
    if (lastReleaseTime) {
      const lastReleaseDate = new Date(lastReleaseTime);
      const monthsSinceLastUpdate = (new Date() - lastReleaseDate) / (1000 * 60 * 60 * 24 * 30);
      if (monthsSinceLastUpdate / MONTHS_THRESHOLD > 1) {
        markdownOutput += `- [${packageName}](https://www.npmjs.com/package/${packageName}) has not been updated in the last ${MONTHS_THRESHOLD} months. Last update: ${lastReleaseDate.toISOString().split('T')[0]}\n`;
      }
    }
  }

  console.log(markdownOutput);
}

await checkPackageUpdates();
