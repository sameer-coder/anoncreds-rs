/* eslint-disable @typescript-eslint/ban-ts-comment */
import type {
  NativeCredentialEntry,
  NativeCredentialProve,
  Anoncreds,
  NativeRevocationEntry,
  NativeCredentialRevocationConfig,
} from 'anoncreds-shared'

import { ObjectHandle } from 'anoncreds-shared'
import { TextDecoder, TextEncoder } from 'util'

import { ByteBuffer } from '../../shared/src/types'

import { handleError } from './error'
import {
  byteBufferToBuffer,
  allocateStringBuffer,
  allocatePointer,
  serializeArguments,
  StringListStruct,
  CredentialEntryStruct,
  CredentialProveStruct,
  CredentialEntryListStruct,
  CredentialProveListStruct,
  RevocationEntryListStruct,
  RevocationEntryStruct,
  allocateInt8Buffer,
  I64ListStruct,
  Int64Array,
  CredRevInfoStruct,
  allocateByteBuffer,
} from './ffi'
import { nativeAnoncreds } from './library'

export class NodeJSAnoncreds implements Anoncreds {
  public generateNonce(): string {
    const ret = allocateStringBuffer()
    nativeAnoncreds.anoncreds_generate_nonce(ret)
    handleError()

    return ret.deref() as string
  }

  public createSchema(options: {
    name: string
    version: string
    issuerId: string
    attributeNames: string[]
  }): ObjectHandle {
    const { name, version, issuerId, attributeNames } = serializeArguments(options)

    const ret = allocatePointer()

    // @ts-ignore
    nativeAnoncreds.anoncreds_create_schema(name, version, issuerId, attributeNames, ret)
    handleError()

    return new ObjectHandle(ret.deref() as number)
  }

  public revocationRegistryDefinitionGetAttribute(options: { objectHandle: ObjectHandle; name: string }) {
    const { objectHandle, name } = serializeArguments(options)

    const ret = allocateStringBuffer()
    nativeAnoncreds.anoncreds_revocation_registry_definition_get_attribute(objectHandle, name, ret)
    handleError()

    return ret.deref() as string
  }

  public credentialGetAttribute(options: { objectHandle: ObjectHandle; name: string }) {
    const { objectHandle, name } = serializeArguments(options)

    const ret = allocateStringBuffer()
    nativeAnoncreds.anoncreds_credential_get_attribute(objectHandle, name, ret)
    handleError()

    return ret.deref() as string
  }

  public createCredentialDefinition(options: {
    schemaId: string
    schema: ObjectHandle
    issuerId: string
    tag: string
    signatureType: string
    supportRevocation: boolean
  }): { credentialDefinition: ObjectHandle; credentialDefinitionPrivate: ObjectHandle; keyProof: ObjectHandle } {
    const { schemaId, issuerId, schema, tag, signatureType, supportRevocation } = serializeArguments(options)

    const credentialDefinitionPtr = allocatePointer()
    const credentialDefinitionPrivatePtr = allocatePointer()
    const keyProofPtr = allocatePointer()

    nativeAnoncreds.anoncreds_create_credential_definition(
      schemaId,
      schema,
      tag,
      issuerId,
      signatureType,
      supportRevocation,
      credentialDefinitionPtr,
      credentialDefinitionPrivatePtr,
      keyProofPtr
    )
    handleError()

    return {
      credentialDefinition: new ObjectHandle(credentialDefinitionPtr.deref() as number),
      credentialDefinitionPrivate: new ObjectHandle(credentialDefinitionPrivatePtr.deref() as number),
      keyProof: new ObjectHandle(keyProofPtr.deref() as number),
    }
  }

  public createCredential(options: {
    credentialDefinition: ObjectHandle
    credentialDefinitionPrivate: ObjectHandle
    credentialOffer: ObjectHandle
    credentialRequest: ObjectHandle
    attributeRawValues: Record<string, string>
    attributeEncodedValues?: Record<string, string>
    revocationRegistryId: string
    revocationConfiguration?: NativeCredentialRevocationConfig
  }): { credential: ObjectHandle } {
    const {
      credentialDefinition,
      credentialDefinitionPrivate,
      credentialOffer,
      credentialRequest,
      revocationRegistryId,
    } = serializeArguments(options)

    const attributeNames = StringListStruct({
      count: Object.keys(options.attributeRawValues).length,
      // @ts-ignore
      data: Object.keys(options.attributeRawValues),
    })

    const attributeRawValues = StringListStruct({
      count: Object.keys(options.attributeRawValues).length,
      // @ts-ignore
      data: Object.values(options.attributeRawValues),
    })

    const attributeEncodedValues = options.attributeEncodedValues
      ? StringListStruct({
          count: Object.keys(options.attributeEncodedValues).length,
          // @ts-ignore
          data: Object.values(options.attributeEncodedValues),
        })
      : undefined

    let revocationConfiguration = CredRevInfoStruct()
    if (options.revocationConfiguration) {
      const { registry, registryDefinition, registryDefinitionPrivate, registryIndex, tailsPath } = serializeArguments(
        options.revocationConfiguration
      )

      let registryUsed

      if (options.revocationConfiguration.registryUsed) {
        registryUsed = I64ListStruct({
          count: options.revocationConfiguration.registryUsed.length,
          // @ts-ignore
          data: Int64Array(options.revocationConfiguration.registryUsed),
        })
      }

      revocationConfiguration = CredRevInfoStruct({
        reg_def: registryDefinition,
        reg_def_private: registryDefinitionPrivate,
        registry,
        reg_idx: registryIndex,
        reg_used: registryUsed,
        tails_path: tailsPath,
      })
    }

    const credentialPtr = allocatePointer()
    nativeAnoncreds.anoncreds_create_credential(
      credentialDefinition,
      credentialDefinitionPrivate,
      credentialOffer,
      credentialRequest,
      // @ts-ignore
      attributeNames,
      attributeRawValues,
      attributeEncodedValues,
      revocationRegistryId,
      revocationConfiguration.ref(),
      credentialPtr
    )
    handleError()

    return {
      credential: new ObjectHandle(credentialPtr.deref() as number),
    }
  }

  public encodeCredentialAttributes(options: { attributeRawValues: Array<string> }): Array<string> {
    const { attributeRawValues } = serializeArguments(options)

    const ret = allocateStringBuffer()

    // @ts-ignore
    nativeAnoncreds.anoncreds_encode_credential_attributes(attributeRawValues, ret)
    handleError()

    const result = ret.deref() as string

    return result.split(',')
  }

  public processCredential(options: {
    credential: ObjectHandle
    credentialRequestMetadata: ObjectHandle
    masterSecret: ObjectHandle
    credentialDefinition: ObjectHandle
    revocationRegistryDefinition?: ObjectHandle | undefined
  }): ObjectHandle {
    const { credential, credentialRequestMetadata, masterSecret, credentialDefinition, revocationRegistryDefinition } =
      serializeArguments(options)

    const ret = allocatePointer()

    nativeAnoncreds.anoncreds_process_credential(
      credential,
      credentialRequestMetadata,
      masterSecret,
      credentialDefinition,
      // @ts-ignore
      revocationRegistryDefinition,
      ret
    )
    handleError()

    return new ObjectHandle(ret.deref() as number)
  }

  public createCredentialOffer(options: {
    schemaId: string
    credentialDefinitionId: string
    keyProof: ObjectHandle
  }): ObjectHandle {
    const { schemaId, credentialDefinitionId, keyProof } = serializeArguments(options)

    const ret = allocatePointer()
    nativeAnoncreds.anoncreds_create_credential_offer(schemaId, credentialDefinitionId, keyProof, ret)
    handleError()

    return new ObjectHandle(ret.deref() as number)
  }

  public createCredentialRequest(options: {
    proverDid?: string
    credentialDefinition: ObjectHandle
    masterSecret: ObjectHandle
    masterSecretId: string
    credentialOffer: ObjectHandle
  }): { credentialRequest: ObjectHandle; credentialRequestMeta: ObjectHandle } {
    const { proverDid, credentialDefinition, masterSecret, masterSecretId, credentialOffer } =
      serializeArguments(options)

    const credentialRequestPtr = allocatePointer()
    const credentialRequestMetaPtr = allocatePointer()

    nativeAnoncreds.anoncreds_create_credential_request(
      proverDid,
      credentialDefinition,
      masterSecret,
      masterSecretId,
      credentialOffer,
      credentialRequestPtr,
      credentialRequestMetaPtr
    )
    handleError()

    return {
      credentialRequest: new ObjectHandle(credentialRequestPtr.deref() as number),
      credentialRequestMeta: new ObjectHandle(credentialRequestMetaPtr.deref() as number),
    }
  }

  public createMasterSecret(): ObjectHandle {
    const ret = allocatePointer()

    nativeAnoncreds.anoncreds_create_master_secret(ret)
    handleError()

    return new ObjectHandle(ret.deref() as number)
  }

  public createPresentation(options: {
    presentationRequest: ObjectHandle
    credentials: NativeCredentialEntry[]
    credentialsProve: NativeCredentialProve[]
    selfAttest: Record<string, string>
    masterSecret: ObjectHandle
    schemas: ObjectHandle[]
    credentialDefinitions: ObjectHandle[]
  }): ObjectHandle {
    const { presentationRequest, masterSecret, schemas, credentialDefinitions } = serializeArguments(options)

    const credentialEntries = options.credentials.map((value) => {
      const { credential, timestamp, revocationState: rev_state } = serializeArguments(value)
      return CredentialEntryStruct({ credential, timestamp, rev_state })
    })

    const credentialEntryList = CredentialEntryListStruct({
      count: credentialEntries.length,
      // @ts-ignore
      data: credentialEntries,
    })

    const credentialProves = options.credentialsProve.map((value) => {
      const { entryIndex: entry_idx, isPredicate: is_predictable, reveal, referent } = serializeArguments(value)

      // @ts-ignore
      return CredentialProveStruct({ entry_idx, referent, is_predictable, reveal })
    })

    const credentialProveList = CredentialProveListStruct({
      count: credentialProves.length,
      // @ts-ignore
      data: credentialProves,
    })

    const selfAttestKeys = StringListStruct({
      count: Object.keys(options.selfAttest).length,
      // @ts-ignore
      data: Object.keys(options.selfAttest),
    })

    const selfAttestValues = StringListStruct({
      count: Object.values(options.selfAttest).length,
      // @ts-ignore
      data: Object.values(options.selfAttest),
    })

    const ret = allocatePointer()

    nativeAnoncreds.anoncreds_create_presentation(
      presentationRequest,
      // @ts-ignore
      credentialEntryList,
      credentialProveList,
      selfAttestKeys,
      selfAttestValues,
      masterSecret,
      schemas,
      credentialDefinitions,
      ret
    )
    handleError()

    return new ObjectHandle(ret.deref() as number)
  }
  public verifyPresentation(options: {
    presentation: ObjectHandle
    presentationRequest: ObjectHandle
    schemas: ObjectHandle[]
    credentialDefinitions: ObjectHandle[]
    revocationRegistryDefinitions: ObjectHandle[]
    revocationEntries: NativeRevocationEntry[]
  }): boolean {
    const { presentation, presentationRequest, schemas, credentialDefinitions, revocationRegistryDefinitions } =
      serializeArguments(options)

    const revocationRegistries =
      options.revocationEntries.length > 0
        ? RevocationEntryListStruct({
            count: options.revocationEntries.length,
            // @ts-ignore
            data: options.revocationEntries.map(({ revocationRegistryDefinitionEntryIndex, entry, timestamp }) => {
              return RevocationEntryStruct({
                def_entry_idx: revocationRegistryDefinitionEntryIndex,
                entry: entry.handle,
                timestamp: timestamp,
              })
            }),
          })
        : undefined

    const ret = allocateInt8Buffer()

    nativeAnoncreds.anoncreds_verify_presentation(
      presentation,
      presentationRequest,
      // @ts-ignore
      schemas,
      credentialDefinitions,
      revocationRegistryDefinitions,
      revocationRegistries,
      ret
    )
    handleError()

    return Boolean(ret.deref() as number)
  }

  public createRevocationRegistry(options: {
    credentialDefinition: ObjectHandle
    credentialDefinitionId: string
    issuerId: string
    tag: string
    revocationRegistryType: string
    maximumCredentialNumber: number
    tailsDirectoryPath?: string | undefined
  }) {
    const {
      credentialDefinition,
      credentialDefinitionId,
      tag,
      revocationRegistryType,
      issuerId,
      maximumCredentialNumber,
      tailsDirectoryPath,
    } = serializeArguments(options)

    const registryDefinitionPtr = allocatePointer()
    const registryDefinitionPrivate = allocatePointer()

    nativeAnoncreds.anoncreds_create_revocation_registry(
      credentialDefinition,
      credentialDefinitionId,
      issuerId,
      tag,
      revocationRegistryType,
      maximumCredentialNumber,
      tailsDirectoryPath,
      registryDefinitionPtr,
      registryDefinitionPrivate
    )
    handleError()

    return {
      registryDefinition: new ObjectHandle(registryDefinitionPtr.deref() as number),
      registryDefinitionPrivate: new ObjectHandle(registryDefinitionPrivate.deref() as number),
    }
  }

  public createOrUpdateRevocationState(options: {
    revocationRegistryDefinition: ObjectHandle
    revocationRegistryList: ObjectHandle
    revocationRegistryIndex: number
    tailsPath: string
    previousRevocationState?: ObjectHandle | undefined
  }): ObjectHandle {
    const { revocationRegistryDefinition, revocationRegistryList, revocationRegistryIndex, tailsPath } =
      serializeArguments(options)

    const previousRevocationState = options.previousRevocationState ?? new ObjectHandle(0)
    const ret = allocatePointer()

    nativeAnoncreds.anoncreds_create_or_update_revocation_state(
      revocationRegistryDefinition,
      revocationRegistryList,
      revocationRegistryIndex,
      tailsPath,
      // @ts-ignore
      previousRevocationState.handle,
      ret
    )
    handleError()

    return new ObjectHandle(ret.deref() as number)
  }
  public version(): string {
    return nativeAnoncreds.anoncreds_version()
  }

  // This should be called when a function returns a non-zero code
  public getCurrentError(): string {
    const ret = allocateStringBuffer()
    nativeAnoncreds.anoncreds_get_current_error(ret)
    handleError()

    return ret.deref() as string
  }

  private objectFromJson(method: (byteBuffer: Buffer, ret: Buffer) => unknown, options: { json: string }) {
    const ret = allocatePointer()

    const byteBuffer = ByteBuffer.fromUint8Array(new TextEncoder().encode(options.json))
    handleError()

    // @ts-ignore
    method(byteBuffer, ret)

    return new ObjectHandle(ret.deref() as number)
  }

  public presentationRequestFromJson(options: { json: string }) {
    return this.objectFromJson(nativeAnoncreds.anoncreds_presentation_request_from_json, options)
  }

  public masterSecretFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_master_secret_from_json, options)
  }

  public credentialRequestFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_credential_request_from_json, options)
  }

  public credentialRequestMetadataFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_credential_request_metadata_from_json, options)
  }

  public revocationRegistryDefinitionFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_revocation_registry_definition_from_json, options)
  }

  public revocationRegistryFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_revocation_registry_from_json, options)
  }

  public revocationStateFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_revocation_state_from_json, options)
  }

  public presentationFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_presentation_from_json, options)
  }

  public credentialOfferFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_credential_offer_from_json, options)
  }

  public schemaFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_schema_from_json, options)
  }

  public credentialFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_credential_from_json, options)
  }

  public revocationRegistryDefinitionPrivateFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_revocation_registry_definition_private_from_json, options)
  }

  public revocationRegistryDeltaFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_revocation_registry_delta_from_json, options)
  }

  public credentialDefinitionFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_credential_definition_from_json, options)
  }

  public credentialDefinitionPrivateFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_credential_definition_private_from_json, options)
  }

  public keyCorrectnessProofFromJson(options: { json: string }): ObjectHandle {
    return this.objectFromJson(nativeAnoncreds.anoncreds_key_correctness_proof_from_json, options)
  }

  public getJson(options: { objectHandle: ObjectHandle }) {
    const ret = allocateByteBuffer()

    const { objectHandle } = serializeArguments(options)
    nativeAnoncreds.anoncreds_object_get_json(objectHandle, ret)
    handleError()

    const output = new Uint8Array(byteBufferToBuffer(ret.deref() as { data: Buffer; len: number }))

    return new TextDecoder().decode(output)
  }

  public getTypeName(options: { objectHandle: ObjectHandle }) {
    const { objectHandle } = serializeArguments(options)

    const ret = allocateStringBuffer()

    nativeAnoncreds.anoncreds_object_get_type_name(objectHandle, ret)
    handleError()

    return ret.deref() as string
  }

  public objectFree(options: { objectHandle: ObjectHandle }) {
    nativeAnoncreds.anoncreds_object_free(options.objectHandle.handle)
    handleError()
  }
}
