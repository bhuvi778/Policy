const fs = require('node:fs');
const path = require('node:path');
const map = JSON.parse(fs.readFileSync('android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map','utf8'));
const files = [
  'App.js', 'src/utils/distribution.js', 'src/screens/MembershipStatusScreen.js',
  'src/screens/SubscriptionPlansScreen.js','src/screens/PaymentWebViewScreen.js',
  'src/components/DrawerSidebar.js','src/screens/SearchScreen.js','src/screens/MyProfileScreen.js',
  'src/screens/SmartCardStyleScreen.js','src/screens/GoogleNFCReviewScreen.js',
  'src/screens/TrainingScreen.js','src/services/downloadQuota.js','src/utils/subscriptionInfo.js',
  'src/utils/extractUserData.js','src/context/AuthContext.js','src/services/api.js',
  'src/services/contentMapper.js','src/services/contentCacheStorage.js',
];
const normalize = value => value.replaceAll('\r\n','\n');
const checks = files.map(file => {
  const index = map.sources.findIndex(source => source.replaceAll('\\','/').endsWith(file));
  return { file, matches: index >= 0 && normalize(map.sourcesContent[index]) === normalize(fs.readFileSync(file,'utf8')) };
});
const output = process.argv[2] || 'outputs/playstore-v48/source-verification.json';
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output, JSON.stringify(checks,null,2)+'\n');
console.log(JSON.stringify(checks));
if(checks.some(check => !check.matches)) process.exitCode = 1;
