/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

/* eslint-disable no-duplicate-imports */

/* eslint-disable react/display-name */

import React, { useContext, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useEffectOnce } from 'react-use';
import { EuiLoadingSpinner } from '@elastic/eui';
import { FormattedMessage } from '@kbn/i18n/react';
import * as selectors from '../store/selectors';
import { EdgeLine } from './edge_line';
import { GraphControls } from './graph_controls';
import { ProcessEventDot } from './process_event_dot';
import { useCamera } from './use_camera';
import { SymbolDefinitions, useResolverTheme } from './assets';
import { useStateSyncingActions } from './use_state_syncing_actions';
import { useResolverQueryParams } from './use_resolver_query_params';
import { StyledMapContainer, StyledPanel, GraphContainer } from './styles';
import { entityId } from '../../../common/endpoint/models/event';
import { SideEffectContext } from './side_effect_context';

/**
 * The highest level connected Resolver component. Needs a `Provider` in its ancestry to work.
 */
export const ResolverMap = React.memo(function ({
  className,
  databaseDocumentID,
  resolverComponentInstanceID,
}: {
  /**
   * Used by `styled-components`.
   */
  className?: string;
  /**
   * The `_id` value of an event in ES.
   * Used as the origin of the Resolver graph.
   */
  databaseDocumentID?: string;
  /**
   * A string literal describing where in the app resolver is located,
   * used to prevent collisions in things like query params
   */
  resolverComponentInstanceID: string;
}) {
  /**
   * This is responsible for dispatching actions that include any external data.
   * `databaseDocumentID`
   */
  useStateSyncingActions({ databaseDocumentID, resolverComponentInstanceID });

  const { timestamp } = useContext(SideEffectContext);

  // use this for the entire render in order to keep things in sync
  const timeAtRender = timestamp();

  const { processNodePositions, connectingEdgeLineSegments } = useSelector(
    selectors.visibleNodesAndEdgeLines
  )(timeAtRender);
  const terminatedProcesses = useSelector(selectors.terminatedProcesses);
  const { projectionMatrix, ref, onMouseDown } = useCamera();
  const isLoading = useSelector(selectors.isLoading);
  const hasError = useSelector(selectors.hasError);
  const activeDescendantId = useSelector(selectors.ariaActiveDescendant);
  const { colorMap } = useResolverTheme();
  const {
    cleanUpQueryParams,
    queryParams: { crumbId },
    pushToQueryParams,
  } = useResolverQueryParams();

  useEffectOnce(() => {
    return () => cleanUpQueryParams();
  });

  useEffect(() => {
    // When you refresh the page after selecting a process in the table view (not the timeline view)
    // The old crumbId still exists in the query string even though a resolver is no longer visible
    // This just makes sure the activeDescendant and crumbId are in sync on load for that view as well as the timeline
    if (activeDescendantId && crumbId !== activeDescendantId) {
      pushToQueryParams({ crumbId: activeDescendantId, crumbEvent: '' });
    }
  }, [crumbId, activeDescendantId, pushToQueryParams]);

  return (
    <StyledMapContainer className={className} backgroundColor={colorMap.resolverBackground}>
      {isLoading ? (
        <div className="loading-container">
          <EuiLoadingSpinner size="xl" />
        </div>
      ) : hasError ? (
        <div className="loading-container">
          <div>
            {' '}
            <FormattedMessage
              id="xpack.securitySolution.endpoint.resolver.loadingError"
              defaultMessage="Error loading data."
            />
          </div>
        </div>
      ) : (
        <GraphContainer
          className="resolver-graph kbn-resetFocusState"
          onMouseDown={onMouseDown}
          ref={ref}
          role="tree"
          tabIndex={0}
          aria-activedescendant={activeDescendantId || undefined}
        >
          {connectingEdgeLineSegments.map(({ points: [startPosition, endPosition], metadata }) => (
            <EdgeLine
              edgeLineMetadata={metadata}
              key={metadata.uniqueId}
              startPosition={startPosition}
              endPosition={endPosition}
              projectionMatrix={projectionMatrix}
            />
          ))}
          {[...processNodePositions].map(([processEvent, position]) => {
            const processEntityId = entityId(processEvent);
            return (
              <ProcessEventDot
                key={processEntityId}
                position={position}
                projectionMatrix={projectionMatrix}
                event={processEvent}
                isProcessTerminated={terminatedProcesses.has(processEntityId)}
                timeAtRender={timeAtRender}
              />
            );
          })}
        </GraphContainer>
      )}
      <StyledPanel />
      <GraphControls />
      <SymbolDefinitions />
    </StyledMapContainer>
  );
});
