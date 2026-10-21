import {
  asError,
  isRecord,
  isStableId,
  isValidFlavorVector,
} from '../contracts';

export class UserPreferenceRepository {
  constructor({ accountSource } = {}) {
    this.accountSource = accountSource;
  }

  async getSnapshot({ userId } = {}) {
    if (userId === null || userId === undefined) {
      return {
        status: 'signed-out',
        userId: null,
        flavorTargets: null,
        error: null,
      };
    }

    try {
      if (!isStableId(userId)) {
        throw new TypeError('Current user ID must be a nonempty string.');
      }

      if (
        !this.accountSource ||
        typeof this.accountSource.getPreferences !== 'function'
      ) {
        throw new Error('Numeric preference source is not connected.');
      }

      const payload = await this.accountSource.getPreferences({ userId });

      if (!isRecord(payload) || payload.userId !== userId) {
        throw new Error(
          'Preference response identity does not match the current user.'
        );
      }

      if (!Object.prototype.hasOwnProperty.call(payload, 'flavorTargets')) {
        throw new TypeError(
          'Preference response must explicitly include flavorTargets.'
        );
      }

      const targets = payload.flavorTargets;

      if (
        targets === null ||
        (isRecord(targets) && Object.keys(targets).length === 0)
      ) {
        return {
          status: 'empty',
          userId,
          flavorTargets: null,
          error: null,
        };
      }

      if (!isValidFlavorVector(targets)) {
        throw new TypeError(
          'Preferences require all six numeric flavor targets in [0, 5].'
        );
      }

      return {
        status: 'ready',
        userId,
        flavorTargets: { ...targets },
        error: null,
      };
    } catch (error) {
      return {
        status: 'unavailable',
        userId,
        flavorTargets: null,
        error: asError(error, 'Preferences unavailable.'),
      };
    }
  }
}

export default UserPreferenceRepository;