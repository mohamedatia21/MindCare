# Data Protection Impact Assessment (DPIA)
## MindCare Clinical AI Agent: Special Category Health Data (GDPR Article 9)

### 1. Systematic Description of Processing
- **Data Controller**: MindCare Clinical Platform
- **Data Categories**: Special Category Mental Health Data (Early Maladaptive Schemas, Trauma Triggers, Psychological States, Crisis Markers).
- **Legal Basis**: GDPR Article 9(2)(a) — Explicit, granular consent.
- **Processing Purpose**: Real-time therapeutic modeling and longitudinal clinical context retention during Schema Therapy sessions with Dr. Ahmed.

---

### 2. Assessment of Necessity and Proportionality
- **Data Minimization**: Raw conversational streams are processed ephemerally. Only structured, generalized clinical schemas (e.g., Abandonment, Defectiveness) are stored in long-term memory.
- **Vector Inversion Mitigation**: Plaintext psychological embeddings are strictly prohibited in public vector indexes to prevent inversion attacks. Sensitive clinical records bypass pgvector and are queried strictly by authenticated `userId` relation.

---

### 3. Risk Assessment & Cryptographic Mitigations

| Risk Identified | Inherent Risk | Technical Mitigation Control | Residual Risk |
| :--- | :--- | :--- | :--- |
| **Unauthorized DB Dump Exfiltration** | CRITICAL | Non-deterministic AES-256-GCM field encryption + KMS Encryption Context. | LOW |
| **Backup Persistence post-GDPR Purge** | CRITICAL | Cryptographic Shredding Token (CST) destruction rendering immutable backups mathematically unreadable. | LOW |
| **Ciphertext Splicing / Substitution** | HIGH | Mandatory Additional Authenticated Data (AAD) binding `{ userId, memoryId, memoryClass }`. | LOW |
| **Stale Cache Read during Partition** | HIGH | Zero-Trust Active Decryption Guard with authoritative live state check. | LOW |
| **Disaster Recovery Backup Invalidation** | MEDIUM | Versioned HMAC-SHA256 Pepper Tombstone replay against external immutable audit log. | LOW |

---

### 4. Operational Trade-Off & Accepted Risk: Fail-Closed Redis Guard

#### 4.1 Trade-Off Definition (Security vs. Availability)
- To guarantee zero staleness and prevent unauthorized reads of shredded or revoked patient data across cluster nodes, the **Active Decryption Guard** performs an authoritative, live state check (`isUserActiveAndConsented`) directly against the primary coordinator (Redis) without local pod TTL caching.
- **Accepted Risk**: If the Redis cluster experiences an outage or network partition, all historical memory decryption requests will **Fail Closed** (`SecurityViolationError`).

#### 4.2 Clinical Continuity & User Experience Plan
1. **Graceful Clinical Degradation**: An outage in the decryption subsystem will **NOT terminate the live audio conversation**. Dr. Ahmed will seamlessly degrade to a present-focused "Supportive Listener / Active Listening" mode without historical trauma memory retrieval.
2. **Monitoring & Alerting**: P1 alerts configured for Redis cluster health, latency deviations (>5ms), and fail-closed decryption spikes.
3. **No Clinical Alarm**: The user is not presented with abrupt technical stack traces or jarring disconnects.
