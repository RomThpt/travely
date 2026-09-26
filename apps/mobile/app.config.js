module.exports = ({ config }) => {
  const rpId = process.env.EXPO_PUBLIC_PASSKEY_RP_ID?.trim().toLowerCase();
  if (!rpId) return config;

  return {
    ...config,
    ios: {
      ...config.ios,
      associatedDomains: [
        ...(config.ios?.associatedDomains ?? []),
        `webcredentials:${rpId}`,
      ],
    },
  };
};
