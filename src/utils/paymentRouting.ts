import { Course, CoursePricing } from '../types';

export const EUROZONE_COUNTRIES = [
  'AUSTRIA', 'BELGIUM', 'CROATIA', 'CYPRUS', 'ESTONIA', 'FINLAND', 'FRANCE', 'GERMANY', 
  'GREECE', 'IRELAND', 'ITALY', 'LATVIA', 'LITHUANIA', 'LUXEMBOURG', 'MALTA', 'NETHERLANDS', 
  'PORTUGAL', 'SLOVAKIA', 'SLOVENIA', 'SPAIN', 'ANDORRA', 'MONACO', 'SAN MARINO', 'VATICAN CITY',
  'MONTENEGRO', 'KOSOVO', 'EUROPE', 'EUROZONE', 'EU'
];

export interface PaymentRouteInfo {
  currency: 'NGN' | 'EUR' | 'USD';
  gateway: 'wittypay' | 'paypal';
  symbol: string;
  gatewayName: string;
}

/**
 * Authoritatively determines currency and gateway according to Ingenium country rules:
 * - Nigeria: Currency NGN, Gateway Wittypay
 * - EUR-country: Currency EUR, Gateway PayPal (manually configured eur_price, no conversion)
 * - All other countries: Currency USD, Gateway PayPal (manually configured usd_price, no conversion)
 */
export function determinePaymentRouting(country?: string): PaymentRouteInfo {
  const countryUpper = (country || '').trim().toUpperCase();

  if (countryUpper === 'NIGERIA' || countryUpper === 'NG') {
    return {
      currency: 'NGN',
      gateway: 'wittypay',
      symbol: '₦',
      gatewayName: 'Wittypay'
    };
  } else if (EUROZONE_COUNTRIES.includes(countryUpper)) {
    return {
      currency: 'EUR',
      gateway: 'paypal',
      symbol: '€',
      gatewayName: 'PayPal'
    };
  } else {
    return {
      currency: 'USD',
      gateway: 'paypal',
      symbol: '$',
      gatewayName: 'PayPal'
    };
  }
}

/**
 * Returns the exact unit price and currency for a course based on student's country
 * Uses manually configured database prices: ngn_price, eur_price, or usd_price.
 * Never introduces currency conversion or exchange rate calculations.
 */
export function getCoursePriceForCountry(
  course: { pricing?: CoursePricing } | null | undefined,
  country?: string
): { price: number; currency: 'NGN' | 'EUR' | 'USD'; symbol: string; gateway: 'wittypay' | 'paypal' } {
  const routing = determinePaymentRouting(country);
  const pricing = course?.pricing;

  let price = 0;
  if (routing.currency === 'NGN') {
    price = pricing?.ngn_price ? Number(pricing.ngn_price) : 200000;
  } else if (routing.currency === 'EUR') {
    price = pricing?.eur_price ? Number(pricing.eur_price) : 400;
  } else {
    price = pricing?.usd_price ? Number(pricing.usd_price) : 400;
  }

  return {
    price,
    currency: routing.currency,
    symbol: routing.symbol,
    gateway: routing.gateway
  };
}
