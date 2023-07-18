const { init } = require('./helpers/init.js');

describe('Contract', async () => {
  let contract;

  let owner;
  let user1, user2, user3, user4, user5, user6;

  before('setup', async () => {
    const setups = await init();

    owner = setups.users[0];
    user1 = setups.users[1];
    user2 = setups.users[2];
    user3 = setups.users[3];
    user4 = setups.users[4];
    user5 = setups.users[5];
    user6 = setups.users[6];

    contract = setups.contract;
  });

  describe('contract', async () => {
    it('deploy successfully', async () => {
      console.log(await contract.getAddress());
    });
  });
});
