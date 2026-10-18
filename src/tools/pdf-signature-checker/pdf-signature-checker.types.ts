/**
 * 单枚签名解析后的结构。字段与 `pdf-signature-reader` 的实际返回值对齐，
 * 但把「不一定存在」的字段如实标成可选 / 可空 —— 老类型把 DN 与 meta 都写成必填 string，
 * 而证书常常缺某个 DN 属性、签名文档也常常没有 Reason/Location/Name，硬标必填只会骗过编译器、骗不过运行时。
 */
export interface SignatureInfo {
  /** 库的综合结论 = integrity && authenticity && !expired。仅为三者的与，不代表法律效力。 */
  verified: boolean
  /** 证书链能否验证到内置受信根（本工具的信任判定，不含 CRL/OCSP 吊销检查）。 */
  authenticity: boolean
  /** 被签名字节范围的摘要是否与签名中记录的一致（防篡改的密码学完整性）。 */
  integrity: boolean
  /** 链上任一证书「当前时刻」是否已过期 / 尚未生效。 */
  expired: boolean
  meta: {
    certs: CertificateDetail[]
    signatureMeta: SignatureMeta
  }
}

export interface CertificateDetail {
  /** 仅链首（签名者）证书带此标记。 */
  clientCertificate?: boolean
  issuedBy: DistinguishedName
  issuedTo: DistinguishedName
  validityPeriod: {
    notBefore: string | Date
    notAfter: string | Date
  }
  pemCertificate: string
}

export interface DistinguishedName {
  commonName?: string
  organizationalUnitName?: string
  organizationName?: string
  countryName?: string
  stateOrProvinceName?: string
  localityName?: string
  serialNumber?: string
}

/** 文档署名信息；库在找不到对应字段时会返回 null，故全部可空。 */
export interface SignatureMeta {
  reason: string | null
  contactInfo: string | null
  location: string | null
  name: string | null
}
