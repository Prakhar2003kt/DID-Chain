// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/** DID-Chain v1: the issuer's EIP-712 digest is stored, not the PDF or its contents. */
contract AcademicCredentialRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct CredentialRecord {
        address issuer;
        uint64 registeredAt;
        bool revoked;
    }
    mapping(bytes32 => CredentialRecord) private records;

    error InvalidIssuer();
    error InvalidDigest();
    error CredentialExists();
    error CredentialMissing();
    error NotOriginalIssuer();
    error AlreadyRevoked();

    event CredentialRegistered(bytes32 indexed digest, address indexed issuer, uint64 timestamp);
    event CredentialRevoked(bytes32 indexed digest, address indexed issuer, uint64 timestamp);
    event IssuerAuthorized(address indexed issuer);
    event IssuerSuspended(address indexed issuer);

    constructor() { _grantRole(DEFAULT_ADMIN_ROLE, msg.sender); }

    function authorizeIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (issuer == address(0)) revert InvalidIssuer();
        grantRole(ISSUER_ROLE, issuer);
        emit IssuerAuthorized(issuer);
    }

    function suspendIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(ISSUER_ROLE, issuer);
        emit IssuerSuspended(issuer);
    }

    function isAuthorizedIssuer(address issuer) external view returns (bool) {
        return hasRole(ISSUER_ROLE, issuer);
    }

    function registerCredential(bytes32 digest) external onlyRole(ISSUER_ROLE) {
        if (digest == bytes32(0)) revert InvalidDigest();
        if (records[digest].issuer != address(0)) revert CredentialExists();
        uint64 whenRegistered = uint64(block.timestamp);
        records[digest] = CredentialRecord(msg.sender, whenRegistered, false);
        emit CredentialRegistered(digest, msg.sender, whenRegistered);
    }

    // A suspended issuer may still revoke its own past credentials, as in the v1 policy.
    function revokeCredential(bytes32 digest) external {
        CredentialRecord storage record = records[digest];
        if (record.issuer == address(0)) revert CredentialMissing();
        if (record.issuer != msg.sender) revert NotOriginalIssuer();
        if (record.revoked) revert AlreadyRevoked();
        record.revoked = true;
        emit CredentialRevoked(digest, msg.sender, uint64(block.timestamp));
    }

    function getCredential(bytes32 digest) external view returns
        (address issuer, uint64 registeredAt, bool revoked) {
        CredentialRecord memory r = records[digest];
        return (r.issuer, r.registeredAt, r.revoked);
    }
}
