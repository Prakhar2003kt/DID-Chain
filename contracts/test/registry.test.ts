import { expect } from 'chai';
import { network } from 'hardhat';

const digest = '0x' + '11'.repeat(32);

describe('AcademicCredentialRegistry — actual on-chain permissions', function () {
  async function fresh() {
    const { ethers } = await network.connect();
    const [admin, issuer, attacker] = await ethers.getSigners();
    const reg = await ethers.deployContract('AcademicCredentialRegistry');
    await reg.waitForDeployment();
    return { reg, admin, issuer, attacker, ethers };
  }
  it('authorizes an issuer and anchors its digest', async () => {
    const { reg, issuer, ethers } = await fresh();
    await reg.authorizeIssuer(issuer.address);
    await expect(reg.connect(issuer).registerCredential(digest)).to.emit(reg, 'CredentialRegistered');
    const record = await reg.getCredential(digest);
    expect(record[0]).to.equal(issuer.address);
    expect(record[1]).to.be.greaterThan(0n);
    expect(record[2]).to.equal(false);
  });
  it('blocks unauthorized registration and duplicate registration', async () => {
    const { reg, issuer, attacker, ethers } = await fresh();
    await expect(reg.connect(attacker).registerCredential(digest)).to.revert(ethers);
    await reg.authorizeIssuer(issuer.address);
    await reg.connect(issuer).registerCredential(digest);
    await expect(reg.connect(issuer).registerCredential(digest)).to.be.revertedWithCustomError(reg, 'CredentialExists');
  });
  it('only original issuer revokes and revocation is irreversible', async () => {
    const { reg, issuer, attacker, ethers } = await fresh();
    await reg.authorizeIssuer(issuer.address);
    await reg.connect(issuer).registerCredential(digest);
    await expect(reg.connect(attacker).revokeCredential(digest)).to.be.revertedWithCustomError(reg, 'NotOriginalIssuer');
    await reg.connect(issuer).revokeCredential(digest);
    expect((await reg.getCredential(digest))[2]).to.equal(true);
    await expect(reg.connect(issuer).revokeCredential(digest)).to.be.revertedWithCustomError(reg, 'AlreadyRevoked');
  });
  it('suspended wallet cannot register but can revoke old credentials', async () => {
    const { reg, issuer, ethers } = await fresh();
    await reg.authorizeIssuer(issuer.address);
    await reg.connect(issuer).registerCredential(digest);
    await reg.suspendIssuer(issuer.address);
    expect(await reg.isAuthorizedIssuer(issuer.address)).to.equal(false);
    await expect(reg.connect(issuer).registerCredential('0x' + '22'.repeat(32))).to.revert(ethers);
    await reg.connect(issuer).revokeCredential(digest);
    expect((await reg.getCredential(digest))[2]).to.equal(true);
  });
});
