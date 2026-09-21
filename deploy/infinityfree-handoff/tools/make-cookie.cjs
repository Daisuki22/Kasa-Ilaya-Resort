const fs = require('fs');

eval(fs.readFileSync('deploy/infinityfree-handoff/aes.js', 'utf8'));

const html = fs.readFileSync('deploy/infinityfree-handoff/latest-challenge.html', 'utf8');
const values = [...html.matchAll(/toNumbers\("([a-f0-9]+)"\)/g)].map((match) => match[1]);

if (values.length < 3) {
  throw new Error('InfinityFree challenge values missing.');
}

const toNumbers = (hex) => {
  const numbers = [];
  hex.replace(/../g, (pair) => numbers.push(parseInt(pair, 16)));
  return numbers;
};

const toHex = (numbers) => numbers.map((number) => `${number < 16 ? '0' : ''}${number.toString(16)}`).join('').toLowerCase();

fs.writeFileSync(
  'deploy/infinityfree-handoff/test-cookie.txt',
  toHex(slowAES.decrypt(toNumbers(values[2]), 2, toNumbers(values[0]), toNumbers(values[1])))
);
