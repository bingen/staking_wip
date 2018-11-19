const { assertRevert } = require('./helpers/assertThrow')

const Staking = embark.require('Embark/contracts/Staking')
const StandardTokenMock = embark.require('Embark/contracts/StandardTokenMock')

const getEvent = (receipt, event, arg) => { return receipt.events.filter(l => l.event == event)[0].args[arg] }

let accounts

config({}, (err, accts) => {
  accounts = accts
})

contract('Staking app', () => {
  let staking, token, owner, other

  const zeroBytes32 = "0x0000000000000000000000000000000000000000000000000000000000000000"
  const TIME_UNIT_BLOCKS = 0
  const TIME_UNIT_SECONDS = 1

  before(async () => {
    owner = accounts[0]
    other = accounts[1]
  })

  beforeEach(async () => {
    const initialAmount = web3.utils.toWei('1000', 'ether')
    token = await StandardTokenMock.deploy({arguments: [owner, initialAmount]}).send()
    staking = await Staking.deploy({arguments: [token.options.address]}).send()
  })

  it('has correct initial state', async () => {
    assert.equal(await staking.methods.token().call(), token.options.address, "Token is wrong")
    assert.equal((await staking.methods.totalStaked().call()).valueOf(), 0, "Initial total staked amount should be zero")
    assert.equal(await staking.methods.supportsHistory().call(), true, "history support should match")
  })

  it('stakes', async () => {
    const amount = 100
    const initialOwnerBalance = parseInt((await token.methods.balanceOf(owner).call()).valueOf(), 10)
    const initialStakingBalance = parseInt((await token.methods.balanceOf(staking.address).call()).valueOf(), 10)

    console.log('owner', owner)
    console.log('other', other)
    console.log('staking', staking.options.address)

    // allow Staking app to move owner tokens
    await token.methods.approve(staking.options.address, amount).send()
    // stake tokens
    const r = await staking.methods.stake(amount, web3.utils.asciiToHex('')).send()

    const finalOwnerBalance = parseInt((await token.methods.balanceOf(owner).call()).valueOf(), 10)
    const finalStakingBalance = parseInt((await token.methods.balanceOf(staking.options.address).call()).valueOf(), 10)
    assert.equal(finalOwnerBalance, initialOwnerBalance - amount, "owner balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + amount, "Staking app balance should match")
    assert.equal((await staking.methods.totalStakedFor(owner).call()).valueOf(), amount, "staked value should match")
    // total stake
    assert.equal((await staking.methods.totalStaked().call()).toString(), amount, "Total stake should match")
  })

  it('fails staking 0 amount', async () => {
    const amount = 0
    await token.methods.approve(staking.options.address, amount).send()
    return assertRevert(async () => {
      await staking.methods.stake(amount, web3.utils.asciiToHex('')).send()
    })
  })

  it('fails staking more than balance', async () => {
    const balance = await token.methods.balanceOf(owner).call()
    const amount = balance + 1
    await token.methods.approve(staking.options.address, amount).send()
    return assertRevert(async () => {
      await staking.methods.stake(amount, web3.utils.asciiToHex('')).send()
    })
  })

  it('stakes for', async () => {
    const amount = 100
    const initialOwnerBalance = parseInt((await token.methods.balanceOf(owner).call()).valueOf(), 10)
    const initialOtherBalance = parseInt((await token.methods.balanceOf(other).call()).valueOf(), 10)
    const initialStakingBalance = parseInt((await token.methods.balanceOf(staking.options.address).call()).valueOf(), 10)

    // allow Staking app to move owner tokens
    await token.methods.approve(staking.options.address, amount).send()
    // stake tokens
    await staking.methods.stakeFor(other, amount, web3.utils.asciiToHex('')).send()

    const finalOwnerBalance = parseInt((await token.methods.balanceOf(owner).call()).valueOf(), 10)
    const finalOtherBalance = parseInt((await token.methods.balanceOf(other).call()).valueOf(), 10)
    const finalStakingBalance = parseInt((await token.methods.balanceOf(staking.options.address).call()).valueOf(), 10)
    assert.equal(finalOwnerBalance, initialOwnerBalance - amount, "owner balance should match")
    assert.equal(finalOtherBalance, initialOtherBalance, "other balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + amount, "Staking app balance should match")
    assert.equal((await staking.methods.totalStakedFor(owner).call()).valueOf(), 0, "staked value for owner should match")
    assert.equal((await staking.methods.totalStakedFor(other).call()).valueOf(), amount, "staked value for other should match")
  })

  it('unstakes', async () => {
    const amount = 100
    const initialOwnerBalance = parseInt((await token.methods.balanceOf(owner).call()).valueOf(), 10)
    const initialStakingBalance = parseInt((await token.methods.balanceOf(staking.options.address).call()).valueOf(), 10)

    // allow Staking app to move owner tokens
    await token.methods.approve(staking.options.address, amount).send()
    // stake tokens
    await staking.methods.stake(amount, web3.utils.asciiToHex('')).send()
    // unstake half of them
    await staking.methods.unstake(amount / 2, web3.utils.asciiToHex('')).send()

    const finalOwnerBalance = parseInt((await token.methods.balanceOf(owner).call()).valueOf(), 10)
    const finalStakingBalance = parseInt((await token.methods.balanceOf(staking.options.address).call()).valueOf(), 10)
    assert.equal(finalOwnerBalance, initialOwnerBalance - amount / 2, "owner balance should match")
    assert.equal(finalStakingBalance, initialStakingBalance + amount / 2, "Staking app balance should match")
    assert.equal((await staking.methods.totalStakedFor(owner).call()).valueOf(), amount / 2, "staked value should match")
  })

  it('fails unstaking 0 amount', async () => {
    const amount = 100
    await token.methods.approve(staking.options.address, amount).send()
    await staking.methods.stake(amount, web3.utils.asciiToHex('')).send()
    return assertRevert(async () => {
      await staking.methods.unstake(0, web3.utils.asciiToHex('')).send()
    })
  })

  it('fails unstaking more than staked', async () => {
    const amount = 100
    await token.methods.approve(staking.options.address, amount).send()
    await staking.methods.stake(amount, web3.utils.asciiToHex('')).send()
    return assertRevert(async () => {
      await staking.methods.unstake(amount + 1, web3.utils.asciiToHex('')).send()
    })
  })
})
