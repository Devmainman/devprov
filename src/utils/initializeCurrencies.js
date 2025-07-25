import Currency from '../models/Currency.js';
const currencies = [
  { title: 'US Dollar', code: 'USD', rate: 1, isBase: true },
  { title: 'Euro', code: 'EUR', rate: 0.91 },
  { title: 'Japanese Yen', code: 'JPY', rate: 157.32 },
  { title: 'British Pound Sterling', code: 'GBP', rate: 0.78 },
  { title: 'Australian Dollar', code: 'AUD', rate: 1.49 },
  { title: 'Canadian Dollar', code: 'CAD', rate: 1.36 },
  { title: 'Swiss Franc', code: 'CHF', rate: 0.89 },
  { title: 'Chinese Yuan', code: 'CNY', rate: 7.25 },
  { title: 'Afghan Afghani', code: 'AFN', rate: 71.55 },
  { title: 'Albanian Lek', code: 'ALL', rate: 91.2 },
  { title: 'Algerian Dinar', code: 'DZD', rate: 134.5 },
  { title: 'Angolan Kwanza', code: 'AOA', rate: 852 },
  { title: 'Argentine Peso', code: 'ARS', rate: 902 },
  { title: 'Armenian Dram', code: 'AMD', rate: 387 },
  { title: 'Aruban Florin', code: 'AWG', rate: 1.8 },
  { title: 'Azerbaijani Manat', code: 'AZN', rate: 1.7 },
  { title: 'Bahamian Dollar', code: 'BSD', rate: 1 },
  { title: 'Bahraini Dinar', code: 'BHD', rate: 0.38 },
  { title: 'Bangladeshi Taka', code: 'BDT', rate: 117 },
  { title: 'Barbadian Dollar', code: 'BBD', rate: 2 },
  { title: 'Belarusian Ruble', code: 'BYN', rate: 3.25 },
  { title: 'Belize Dollar', code: 'BZD', rate: 2.0 },
  { title: 'Bermudian Dollar', code: 'BMD', rate: 1 },
  { title: 'Bhutanese Ngultrum', code: 'BTN', rate: 83 },
  { title: 'Bolivian Boliviano', code: 'BOB', rate: 6.9 },
  { title: 'Bosnia-Herzegovina Convertible Mark', code: 'BAM', rate: 1.78 },
  { title: 'Botswanan Pula', code: 'BWP', rate: 13.45 },
  { title: 'Brazilian Real', code: 'BRL', rate: 5.32 },
  { title: 'Brunei Dollar', code: 'BND', rate: 1.35 },
  { title: 'Bulgarian Lev', code: 'BGN', rate: 1.79 },
  { title: 'Burundian Franc', code: 'BIF', rate: 2885 },
  { title: 'Cambodian Riel', code: 'KHR', rate: 4100 },
  { title: 'Cape Verdean Escudo', code: 'CVE', rate: 101 },
  { title: 'Cayman Islands Dollar', code: 'KYD', rate: 0.82 },
  { title: 'CFA Franc BCEAO', code: 'XOF', rate: 603 },
  { title: 'CFA Franc BEAC', code: 'XAF', rate: 602 },
  { title: 'CFP Franc', code: 'XPF', rate: 110 },
  { title: 'Chilean Peso', code: 'CLP', rate: 942 },
  { title: 'Colombian Peso', code: 'COP', rate: 3921 },
  { title: 'Comorian Franc', code: 'KMF', rate: 452 },
  { title: 'Congolese Franc', code: 'CDF', rate: 2775 },
  { title: 'Costa Rican Colón', code: 'CRC', rate: 522 },
  { title: 'Croatian Kuna', code: 'HRK', rate: 6.93 },
  { title: 'Cuban Peso', code: 'CUP', rate: 24 },
  { title: 'Czech Republic Koruna', code: 'CZK', rate: 23.1 },
  { title: 'Danish Krone', code: 'DKK', rate: 6.79 },
  { title: 'Djiboutian Franc', code: 'DJF', rate: 177 },
  { title: 'Dominican Peso', code: 'DOP', rate: 59 },
  { title: 'East Caribbean Dollar', code: 'XCD', rate: 2.7 },
  { title: 'Egyptian Pound', code: 'EGP', rate: 47.9 },
  { title: 'Eritrean Nakfa', code: 'ERN', rate: 15 },
  { title: 'Eswatini Lilangeni', code: 'SZL', rate: 18.5 },
  { title: 'Ethiopian Birr', code: 'ETB', rate: 57 },
  { title: 'Falkland Islands Pound', code: 'FKP', rate: 0.78 },
  { title: 'Fijian Dollar', code: 'FJD', rate: 2.25 },
  { title: 'Gambian Dalasi', code: 'GMD', rate: 66 },
  { title: 'Georgian Lari', code: 'GEL', rate: 2.68 },
  { title: 'Ghanaian Cedi', code: 'GHS', rate: 15.3 },
  { title: 'Gibraltar Pound', code: 'GIP', rate: 0.78 },
  { title: 'Guatemalan Quetzal', code: 'GTQ', rate: 7.85 },
  { title: 'Guinean Franc', code: 'GNF', rate: 8580 },
  { title: 'Guyanaese Dollar', code: 'GYD', rate: 210 },
  { title: 'Haitian Gourde', code: 'HTG', rate: 132 },
  { title: 'Honduran Lempira', code: 'HNL', rate: 24.6 },
  { title: 'Hungarian Forint', code: 'HUF', rate: 358 },
  { title: 'Icelandic Króna', code: 'ISK', rate: 139 },
  { title: 'Indian Rupee', code: 'INR', rate: 83 },
  { title: 'Indonesian Rupiah', code: 'IDR', rate: 15900 },
  { title: 'Iranian Rial', code: 'IRR', rate: 42000 },
  { title: 'Iraqi Dinar', code: 'IQD', rate: 1310 },
  { title: 'Israeli New Sheqel', code: 'ILS', rate: 3.65 },
  { title: 'Jamaican Dollar', code: 'JMD', rate: 155 },
  { title: 'Jordanian Dinar', code: 'JOD', rate: 0.71 },
  { title: 'Kazakhstani Tenge', code: 'KZT', rate: 450 },
  { title: 'Kenyan Shilling', code: 'KES', rate: 130 },
  { title: 'Kuwaiti Dinar', code: 'KWD', rate: 0.31 },
  { title: 'Kyrgystani Som', code: 'KGS', rate: 89 },
  { title: 'Laotian Kip', code: 'LAK', rate: 21500 },
  { title: 'Lebanese Pound', code: 'LBP', rate: 89000 },
  { title: 'Lesotho Loti', code: 'LSL', rate: 18.5 },
  { title: 'Liberian Dollar', code: 'LRD', rate: 190 },
  { title: 'Libyan Dinar', code: 'LYD', rate: 4.84 },
  { title: 'Macanese Pataca', code: 'MOP', rate: 8.09 },
  { title: 'Malagasy Ariary', code: 'MGA', rate: 4560 },
  { title: 'Malawian Kwacha', code: 'MWK', rate: 1725 },
  { title: 'Malaysian Ringgit', code: 'MYR', rate: 4.7 },
  { title: 'Maldivian Rufiyaa', code: 'MVR', rate: 15.3 },
  { title: 'Mauritanian Ouguiya', code: 'MRU', rate: 39.8 },
  { title: 'Mauritian Rupee', code: 'MUR', rate: 46.3 },
  { title: 'Mexican Peso', code: 'MXN', rate: 18.2 },
  { title: 'Moldovan Leu', code: 'MDL', rate: 17.7 },
  { title: 'Mongolian Tugrik', code: 'MNT', rate: 3445 },
  { title: 'Moroccan Dirham', code: 'MAD', rate: 10.1 },
  { title: 'Mozambican Metical', code: 'MZN', rate: 63 },
  { title: 'Myanmar Kyat', code: 'MMK', rate: 2100 },
  { title: 'Namibian Dollar', code: 'NAD', rate: 18.5 },
  { title: 'Nepalese Rupee', code: 'NPR', rate: 132 },
  { title: 'New Taiwan Dollar', code: 'TWD', rate: 32.5 },
  { title: 'New Zealand Dollar', code: 'NZD', rate: 1.63 },
  { title: 'Nicaraguan Córdoba', code: 'NIO', rate: 36.5 },
  { title: 'Nigerian Naira', code: 'NGN', rate: 1480 },
  { title: 'North Korean Won', code: 'KPW', rate: 900 },
  { title: 'Omani Rial', code: 'OMR', rate: 0.38 },
  { title: 'Pakistani Rupee', code: 'PKR', rate: 278 },
  { title: 'Panamanian Balboa', code: 'PAB', rate: 1 },
  { title: 'Paraguayan Guarani', code: 'PYG', rate: 7280 },
  { title: 'Peruvian Sol', code: 'PEN', rate: 3.75 },
  { title: 'Philippine Peso', code: 'PHP', rate: 58 },
  { title: 'Polish Zloty', code: 'PLN', rate: 4.03 },
  { title: 'Qatari Rial', code: 'QAR', rate: 3.64 },
  { title: 'Romanian Leu', code: 'RON', rate: 4.56 },
  { title: 'Russian Ruble', code: 'RUB', rate: 88 },
  { title: 'Rwandan Franc', code: 'RWF', rate: 1270 },
  { title: 'Saint Helena Pound', code: 'SHP', rate: 0.78 },
  { title: 'Samoan Tala', code: 'WST', rate: 2.72 },
  { title: 'São Tomé and Príncipe Dobra', code: 'STN', rate: 23.5 },
  { title: 'Saudi Riyal', code: 'SAR', rate: 3.75 },
  { title: 'Serbian Dinar', code: 'RSD', rate: 108 },
  { title: 'Seychellois Rupee', code: 'SCR', rate: 14.6 },
  { title: 'Sierra Leonean Leone', code: 'SLE', rate: 23.6 },
  { title: 'Singapore Dollar', code: 'SGD', rate: 1.35 },
  { title: 'Solomon Islands Dollar', code: 'SBD', rate: 8.35 },
  { title: 'Somali Shilling', code: 'SOS', rate: 570 },
  { title: 'South African Rand', code: 'ZAR', rate: 18.4 },
  { title: 'South Korean Won', code: 'KRW', rate: 1370 },
  { title: 'South Sudanese Pound', code: 'SSP', rate: 1000 },
  { title: 'Sri Lankan Rupee', code: 'LKR', rate: 301 },
  { title: 'Sudanese Pound', code: 'SDG', rate: 1080 },
  { title: 'Surinamese Dollar', code: 'SRD', rate: 38 },
  { title: 'Swedish Krona', code: 'SEK', rate: 10.6 },
  { title: 'Syrian Pound', code: 'SYP', rate: 12900 },
  { title: 'Tajikistani Somoni', code: 'TJS', rate: 10.9 },
  { title: 'Tanzanian Shilling', code: 'TZS', rate: 2500 },
  { title: 'Thai Baht', code: 'THB', rate: 36.6 },
  { title: 'Tongan Paʻanga', code: 'TOP', rate: 2.35 },
  { title: 'Trinidad and Tobago Dollar', code: 'TTD', rate: 6.8 },
  { title: 'Tunisian Dinar', code: 'TND', rate: 3.1 },
  { title: 'Turkish Lira', code: 'TRY', rate: 32.5 },
  { title: 'Turkmenistani Manat', code: 'TMT', rate: 3.5 },
  { title: 'Ugandan Shilling', code: 'UGX', rate: 3820 },
  { title: 'Ukrainian Hryvnia', code: 'UAH', rate: 39.3 },
  { title: 'Uruguayan Peso', code: 'UYU', rate: 38.2 },
  { title: 'Uzbekistan Som', code: 'UZS', rate: 12650 },
  { title: 'Vanuatu Vatu', code: 'VUV', rate: 118 },
  { title: 'Venezuelan Bolívar', code: 'VES', rate: 36.2 },
  { title: 'Vietnamese Dong', code: 'VND', rate: 25450 },
  { title: 'Yemeni Rial', code: 'YER', rate: 250 },
  { title: 'Zambian Kwacha', code: 'ZMW', rate: 26.5 },
  { title: 'Hong Kong Dollar', code: 'HKD', rate: 7.83 },
  { title: 'Norwegian Krone', code: 'NOK', rate: 10.7 }
];

export const initializeCurrencies = async () => {
  try {
    const count = await Currency.countDocuments();
    if (count === 0) {
      await Currency.insertMany(currencies);
      console.log('Currencies database initialized');
    }
  } catch (error) {
    console.error('Currency initialization error:', error);
  }
};