const bcrypt = require("bcrypt");

async function run() {
  const password = "1234"; // test password
  const hash = await bcrypt.hash(password, 10);
  console.log(hash);
}

run();
