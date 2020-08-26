/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import React, { useCallback, useState } from 'react';
import { Localized } from '@fluent/react';
import dayjs from 'dayjs';
import { useNonce } from '../../lib/hooks';
import { useBooleanState } from 'fxa-react/lib/hooks';
import { getErrorMessage } from '../../lib/errors';
import { SelectorReturns } from '../../store/selectors';
import { Customer } from '../../store/types';
import PaymentForm from '../../components/PaymentForm';
import ErrorMessage from '../../components/ErrorMessage';
import { SubscriptionsProps } from './index';
import * as Amplitude from '../../lib/amplitude';

export type PaymentUpdateFormProps = {
  customer: Customer;
  resetUpdatePayment: SubscriptionsProps['resetUpdatePayment'];
  updatePayment: SubscriptionsProps['updatePayment'];
  updatePaymentStatus: SelectorReturns['updatePaymentStatus'];
};

export const PaymentUpdateForm = ({
  updatePayment: updatePaymentBase,
  updatePaymentStatus,
  resetUpdatePayment: resetUpdatePaymentBase,
  customer,
}: PaymentUpdateFormProps) => {
  const [submitNonce, refreshSubmitNonce] = useNonce();
  const [updateRevealed, revealUpdate, hideUpdate] = useBooleanState();
  const [createTokenError, setCreateTokenError] = useState({
    type: '',
    error: false,
  });

  const resetUpdatePayment = useCallback(async () => {
    resetUpdatePaymentBase();
    refreshSubmitNonce();
  }, [resetUpdatePaymentBase, refreshSubmitNonce]);

  const updatePayment = useCallback(
    async (...args: Parameters<typeof updatePaymentBase>) => {
      await updatePaymentBase(...args);
      refreshSubmitNonce();
    },
    [updatePaymentBase, refreshSubmitNonce]
  );

  const onRevealUpdateClick = useCallback(() => {
    resetUpdatePayment();
    revealUpdate();
  }, [resetUpdatePayment, revealUpdate]);

  const onPayment = useCallback(
    (tokenResponse: stripe.TokenResponse | null) => {
      if (tokenResponse && tokenResponse.token) {
        updatePayment(tokenResponse.token.id);
      } else {
        // This shouldn't happen with a successful createToken() call, but let's
        // display an error in case it does.
        const error: any = { type: 'api_error', error: true };
        setCreateTokenError(error);
      }
    },
    [updatePayment, setCreateTokenError]
  );

  const onPaymentError = useCallback(
    (error: any) => {
      error.error = true;
      setCreateTokenError(error);
    },
    [setCreateTokenError]
  );

  // clear any error rendered with `ErrorMessage`
  const onChange = useCallback(() => {
    setCreateTokenError({ type: '', error: false });
    resetUpdatePayment();
  }, [setCreateTokenError, resetUpdatePayment]);

  const onFormMounted = useCallback(() => Amplitude.updatePaymentMounted(), []);

  const onFormEngaged = useCallback(() => Amplitude.updatePaymentEngaged(), []);

  const inProgress = updatePaymentStatus.loading;

  const { last4, exp_month, exp_year } = customer;

  // https://github.com/iamkun/dayjs/issues/639
  const expirationDate = dayjs()
    .set('month', Number(exp_month) - 1)
    .set('year', Number(exp_year))
    .format('MMMM YYYY');

  return (
    <div className="settings-unit">
      <div className="payment-update">
        <header>
          <h2 className="billing-title">
            <Localized id="sub-update-title">
              <span className="title">Billing Information</span>
            </Localized>
          </h2>
        </header>
        {!updateRevealed ? (
          <div className="with-settings-button">
            <div className="card-details" data-testid="card-details">
              {last4 && expirationDate && (
                <>
                  {/* TODO: Need to find a way to display a card icon here? */}
                  <Localized id="sub-update-card-ending" vars={{ last: last4 }}>
                    <div className="last-four">Card ending {last4}</div>
                  </Localized>
                  <Localized id="pay-update-card-exp" vars={{ expirationDate }}>
                    <div data-testid="card-expiration-date" className="expiry">
                      Expires {expirationDate}
                    </div>
                  </Localized>
                </>
              )}
            </div>
            <div className="action">
              <button
                data-testid="reveal-payment-update-button"
                className="settings-button"
                onClick={onRevealUpdateClick}
              >
                <Localized id="pay-update-change-btn">
                  <span className="change-button">Change</span>
                </Localized>
              </button>
            </div>
          </div>
        ) : (
          <>
            <ErrorMessage isVisible={!!createTokenError.error}>
              {createTokenError.error && (
                <p data-testid="error-payment-submission">
                  {getErrorMessage(createTokenError.type)}
                </p>
              )}
            </ErrorMessage>

            <ErrorMessage isVisible={!!updatePaymentStatus.error}>
              {updatePaymentStatus.error && (
                <p data-testid="error-billing-update">
                  {updatePaymentStatus.error.message}
                </p>
              )}
            </ErrorMessage>

            <PaymentForm
              {...{
                submitNonce,
                onPayment,
                onPaymentError,
                inProgress,
                confirm: false,
                onCancel: hideUpdate,
                onChange,
                onMounted: onFormMounted,
                onEngaged: onFormEngaged,
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentUpdateForm;
