import type {
  InitPageResult,
  PayloadRequest,
  SanitizedCollectionConfig,
  SanitizedConfig,
  SanitizedGlobalConfig,
} from 'payload/types'

import { initI18n } from '@payloadcms/translations'
import { translations } from '@payloadcms/translations/client'
import { findLocaleFromCode } from '@payloadcms/ui'
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { createLocalReq } from 'payload/utilities'
import qs from 'qs'

import { auth } from './auth'
import { getRequestLanguage } from './getRequestLanguage'

type Args = {
  config: Promise<SanitizedConfig> | SanitizedConfig
  redirectUnauthenticatedUser?: boolean
  route?: string
  searchParams?: { [key: string]: string | string[] | undefined }
}

export const initPage = async ({
  config: configPromise,
  redirectUnauthenticatedUser = false,
  route,
  searchParams,
}: Args): Promise<InitPageResult> => {
  const headers = getHeaders()
  const localeParam = searchParams?.locale as string
  const { cookies, permissions, user } = await auth({
    config: configPromise,
    headers,
  })

  const config = await configPromise
  const routeSegments = route.replace(config.routes.admin, '').split('/').filter(Boolean)
  const collectionSlug = routeSegments[0] === 'collections' ? routeSegments[1] : undefined
  const globalSlug = routeSegments[0] === 'globals' ? routeSegments[1] : undefined

  const { collections, globals, localization, routes } = config

  if (redirectUnauthenticatedUser && !user && route !== '/login') {
    const stringifiedSearchParams = Object.keys(searchParams ?? {}).length
      ? `?${qs.stringify(searchParams)}`
      : ''

    redirect(`${routes.admin}/login?redirect=${route + stringifiedSearchParams}`)
  }

  const payload = await getPayload({ config })

  const defaultLocale =
    localization && localization.defaultLocale ? localization.defaultLocale : 'en'
  const localeCode = localeParam || defaultLocale
  const locale = localization && findLocaleFromCode(localization, localeCode)
  const language = getRequestLanguage({ cookies, headers })
  const i18n = initI18n({
    config: config.i18n,
    context: 'client',
    language,
    translations,
  })

  const req = await createLocalReq(
    {
      fallbackLocale: null,
      locale: locale.code,
      req: {
        i18n,
      } as PayloadRequest,
      user,
    },
    payload,
  )

  let collectionConfig: SanitizedCollectionConfig
  let globalConfig: SanitizedGlobalConfig

  if (collectionSlug) {
    collectionConfig = collections.find((collection) => collection.slug === collectionSlug)
  }

  if (globalSlug) {
    globalConfig = globals.find((global) => global.slug === globalSlug)
  }

  return {
    collectionConfig,
    globalConfig,
    locale,
    permissions,
    req,
  }
}