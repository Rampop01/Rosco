# Product Requirement Document (PRD): Rosco
**Decentralized Rotating Savings & Target Vaults on Nimiq**

---

## 1. Document Overview
* **Product Name**: Rosco
* **Tagline**: The Modern, Non-Custodial Community Savings & Target Vault Platform
* **Document Version**: 1.0.0
* **Target Audience**: Product Managers, Engineers, Hackathon Judges, Investors, Community Organizers
* **Blockchain Protocol**: Nimiq Albatross (Proof-of-Stake)
* **Status**: Live / Production-Ready

---

## 2. Executive Summary & Vision
**Rosco** bridges traditional community finance (ROSCAs, Esusu, Kolo, Tandas, Chit Funds) and modern decentralized finance (DeFi). By eliminating intermediaries, predatory banking fees, and manual accounting, Rosco allows groups and individuals around the world to pool capital, maintain saving discipline, and achieve financial goals through the ultra-fast, micro-fee **Nimiq blockchain**.

### Vision Statement
> To empower communities and individuals worldwide with transparent, accessible, and self-custodial financial tools that make saving social, fair, and frictionless.

---

## 3. Problem Statement & Market Opportunity

### 3.1 The Informal Savings Economy
Over **1 billion people** across Latin America, Africa, Asia, and the Caribbean rely on informal rotating savings groups:
* **Market Size**: Circulating over **$500 Billion** annually.
* **Cultural Names**: *Esusu / Kolo* (Nigeria), *Tandas* (Mexico), *Chit Funds* (India), *Hui* (China), *Pardna* (Jamaica), *Ayuuto* (Somalia).

### 3.2 Pain Points of Traditional Systems
1. **Counterparty Default Risk**: If an early recipient abandons the circle, subsequent members lose their capital.
2. **Opaque & Disputed Turn Order**: Turn selection is often contested, creating social friction or accusations of favoritism.
3. **Manual Bookkeeping & Theft**: Cash collection requires physical aggregation, creating theft hazards, transit costs, and accounting discrepancies.
4. **Predatory Banking Barriers**: Traditional banks enforce high account maintenance fees, rigid identity hurdles, and provide sub-inflation interest rates.

---

## 4. User Personas

| Persona | Role | Key Motivations | Core Frustrations |
| :--- | :--- | :--- | :--- |
| **Amina (The Circle Organizer)** | Informal group leader, trusted community figure | Wants an easy, transparent way to gather and distribute funds without tracking paper receipts or chasing late payments. | Spends hours manually reconciling who paid; gets blamed if turn order seems unfair. |
| **Carlos (The Social Saver)** | Freelancer / Gig worker | Needs structured peer accountability to build lump-sum capital for equipment or inventory without high-interest loans. | Worries that other participants might disappear after taking their early payout round. |
| **Elena (The Goal Saver)** | University student / Early professional | Saving for a laptop, holiday trip, or emergency fund; needs strict discipline to prevent impulse spending. | High bank maintenance fees; easily breaks voluntary savings without time-locks. |

---

## 5. Product Objectives & Success Metrics (KPIs)

### 5.1 Business & Impact Goals
* Enable **0% platform fee** decentralized capital rotation.
* Provide instant **1-Tap Nimiq Pay** transactions with sub-second finality.
* Guarantee mathematical fairness in payout distribution using cryptographic shuffling.

### 5.2 Key Performance Indicators (KPIs)
* **Total Volume Circulated (TVC)**: Total NIM deposited through Rosco circles and target vaults.
* **Circle Completion Rate**: % of created circles that successfully complete all rounds.
* **Average Time to Fill**: Duration from circle creation to all slots being filled.
* **Target Savings Retention**: % of vaults held until target goal completion vs. early exits.

---

## 6. Functional Requirements & Feature Specifications

### 6.1 Rotating Savings Circles (Kolo / ROSCAs)

#### 6.1.1 Circle Creation
* **Parameters**:
  * **Circle Name**: 3 to 50 characters.
  * **Contribution Amount**: In NIM (e.g., 50, 100, 500 NIM).
  * **Cadence**: `Daily`, `Weekly`, or `Monthly`.
  * **Member Capacity**: Minimum 3 members, maximum 30 members.
* **Organizer Privileges**:
  * Organizer is automatically enrolled as Member #1 upon creation.
  * Ability to share custom invite link (`/circle/:id`).
  * Dedicated organizer approval hub to manage incoming join requests.

#### 6.1.2 Membership & Onboarding
* Prospective members join via invite URL.
* Non-members see a **"Request to Join"** button.
* Organizers review pending requests and can click **"Approve"** or **"Reject"**.
* Approved members receive an instant in-app notification confirming their status.

#### 6.1.3 Fair Turn Randomization (Fisher-Yates)
* When the organizer clicks **"Start Circle"**, Rosco executes an unbiased Fisher-Yates shuffle across all approved members.
* The generated array becomes the immutable payout sequence for rounds 1 through *N*.

#### 6.1.4 Round Execution & Payment Engine
* **Active Round Indicator**: Clearly displays Round Number, Target Pot, and Active Recipient address.
* **Payment Button**: `Pay Round (X NIM)`.
* **State Locking**: Once a member pays their round:
  * Status switches to `✓ Paid`.
  * The payment button is disabled with a live countdown timer until the next round starts.
  * Real-time contribution progress is displayed (e.g., `1 / 3 Paid`).
* **Pot Distribution**: Lump-sum pot is transferred directly to the designated recipient for that round.

---

### 6.2 Personal Target Savings Vaults

#### 6.2.1 Vault Goal Creation
* **Target Category**: Tech Gadget, Emergency Fund, Rent / Housing, Vacation, Education, Custom.
* **Target Amount**: Specified in NIM (e.g., 1,000 NIM).
* **Savings Discipline Mode**:
  * **Flexible**: Saver deposits any amount at any time.
  * **Scheduled**: Saver selects fixed cadence (`Daily`, `Weekly`, `Monthly`) with deposit lock countdowns.

#### 6.2.2 Automated On-Chain Vault Payout
* Automated keypair signing using the Rosco Vault Mnemonic (`@nimiq/core`).
* When the milestone reaches 100%, user initiates withdrawal:
  * **Full Goal Achieved**: **0% Fee** (100% of accumulated balance returned).
  * **Emergency Early Exit**: **10% Penalty** applied to enforce commitment.
* Immediate blockchain broadcast with public transaction hash returned to user.

---

### 6.3 Real-Time Notification Center
* Sticky in-app notification drawer tracking user and circle events:
  * `CIRCLE_CREATED`: Confirming circle setup.
  * `JOIN_REQUEST_RECEIVED`: Alerting organizers of new applicants.
  * `JOIN_REQUEST_APPROVED`: Alerting users they are eligible to participate.
  * `ROUND_STARTED`: Alerting members to deposit for the new round.
  * `POT_DISBURSED`: Congratulating the round winner.
  * `TARGET_REACHED`: Alerting target vault savers of goal attainment.

---

## 7. User Flows & Interaction Journeys

### Flow A: Rotating Savings Circle Lifecycle
1. **Creation**: Organizer connects Nimiq wallet, defines contribution (e.g., 100 NIM weekly, 4 members), and submits.
2. **Invitation**: Organizer sends invite link to friends/peers.
3. **Approval**: Members request entry; organizer approves verified participants.
4. **Shuffling & Launch**: Organizer starts the circle; Fisher-Yates algorithm determines fair payout rounds.
5. **Round Contributions**: Each member taps "Pay Round" with Nimiq Pay.
6. **Payout**: Current round recipient receives the aggregated pot (400 NIM).
7. **Rotation**: System advances to Round 2; cycle repeats until all members have received their payout.

### Flow B: Target Savings Lifecycle
1. **Setup**: User sets a goal of 1,000 NIM for "New Laptop" with weekly deposits.
2. **Accumulation**: User deposits 250 NIM every week. UI displays progress bar and time-lock countdown.
3. **Milestone Reached**: Balance reaches 1,000 NIM.
4. **Automated Payout**: User clicks "Withdraw"; backend signs an on-chain transaction via `@nimiq/core` and deposits 1,000 NIM into the user's primary wallet.

---

## 8. Technical Architecture & Blockchain Specifications

### 8.1 Stack Overview
* **Frontend Application**: Next.js 14 (App Router), React 18, TypeScript, CSS Variables Design System.
* **Backend / API**: Next.js Edge & Serverless Functions (`/api/circles`, `/api/rounds`, `/api/target-savings/withdraw`).
* **Blockchain Core**: `@nimiq/core` (Ed25519 cryptography, BIP39 Key Derivation).
* **Wallet Protocol**: Nimiq Pay Web SDK & Nimiq Hub.

### 8.2 Cryptographic Key Derivation Path
$$\text{Path: } m / 44' / 242' / 0' / 0'$$
* **BIP44 Coin Type**: `242` (Nimiq NIM).
* **Mnemonic**: 24-word secure vault seed phrase.

### 8.3 Network Configurations

| Environment | Network ID | RPC Node URL |
| :--- | :--- | :--- |
| **Albatross Testnet** | `1` | `https://v2.nimiq-testnet.nuxt.dev` |
| **Albatross Mainnet** | `42` | `https://rpc.nimiqwatch.com` |

---

## 9. Non-Functional Requirements (NFRs)

### 9.1 Performance & Latency
* Page load time < 1.5 seconds.
* Blockchain payment confirmation < 2 seconds (leveraging Nimiq Albatross micro-blocks).
* In-app status synchronization < 500ms.

### 9.2 Security & Trust
* **Non-Custodial Design**: Rosco does not hold user private keys; payments are authorized through Nimiq Pay.
* **Vault Multi-Layer Isolation**: Vault withdrawal endpoints authenticate request integrity and validate on-chain deposit states.
* **Sanitized Inputs**: Zero possibility of SQL/Script injection across circle parameters.

### 9.3 Accessibility & Design System
* High-contrast design standards (WCAG AAA compliant text tokens).
* Responsive layout optimized for mobile screens (iPhone, Android) and desktop viewports.

---

## 10. Risks, Edge Cases & Mitigation Strategies

| Risk Scenario | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Member stops paying after receiving their pot** | Loss of subsequent pots for remaining members. | Organizer approval gate ensures peer trust; social reputation scoring; automated collateral deposits (Phase 2 roadmap). |
| **Network latency or dropped RPC connection** | Payment appears delayed on frontend. | Dual RPC failover logic and automatic transaction hash verification polling. |
| **Accidental double-payment in a single round** | Over-contribution by a member. | Strict client & server payment lockouts with countdown timer disable states upon confirmed payment. |

---

## 11. Product Roadmap

### Phase 1: MVP & Core Delivery (Current)
- [x] Full rotating savings circle engine (Daily/Weekly/Monthly).
- [x] Shareable invite links & organizer approval dashboard.
- [x] Fisher-Yates fair turn randomization.
- [x] Automated target savings vaults with `@nimiq/core` non-custodial payouts.
- [x] Real-time notification center & dynamic contribution badges.
- [x] Multi-resolution favicon, high-contrast UI, and animated ribbon branding.

### Phase 2: Social & Trust Layer (Q4 2026)
- [ ] On-chain reputation scores for reliable savers.
- [ ] Automated SMS & Telegram bot reminders for upcoming round deadlines.
- [ ] Multi-sig vault option for cooperative groups.

### Phase 3: Yield & Deflationary Mechanisms (Q1 2027)
- [ ] Nimiq Proof-of-Stake validator staking integration for pooled balances.
- [ ] Micro-interest accrual for target vault savers.
- [ ] Cross-chain gateway integration with Bitcoin and stablecoins via Nimiq FastSpot.

---

## 12. Sign-Off & Approvals

| Stakeholder | Role | Date | Status |
| :--- | :--- | :--- | :--- |
| **Product Lead** | Rosco Core Team | September 2026 | Approved |
| **Blockchain Architect**| Nimiq Ecosystem Engineering | September 2026 | Approved |
| **Lead Frontend Engineer**| Fullstack Development Team | September 2026 | Approved |
