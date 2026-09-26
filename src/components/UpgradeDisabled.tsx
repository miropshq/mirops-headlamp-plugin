import { Link, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import React from 'react';

// Release name and namespace vary per install, so they stay as placeholders rather than a guess.
const ENABLE_COMMAND = `helm upgrade <release> oci://ghcr.io/miropshq/charts/mirops \\
  -n <namespace> --reuse-values --set upgrade.enabled=true`;

// UpgradeDisabled replaces the Upgrade Analyses pages when the install runs with upgrade.enabled=false:
// the operator isn't reconciling UpgradeAnalysis resources, so creating one would sit on "Analyzing"
// forever. It says so, shows how to turn it on, and points to the mirror, which is running.
export function UpgradeDisabled({ mirrorName, atRisk }: { mirrorName?: string; atRisk?: number }) {
  return (
    <SectionBox title="Upgrade Analyses">
      <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 760 }}>
        <Typography variant="h6" fontWeight={600}>
          Upgrade analysis is turned off
        </Typography>
        <Typography variant="body2">
          This install runs the cluster mirror only, so the operator isn&apos;t processing
          UpgradeAnalysis resources. An analysis created now would stay on &quot;Analyzing&quot; and
          never finish.
        </Typography>
        <Typography variant="body2">
          To check whether the cluster is ready for a new Kubernetes version, turn it on:
        </Typography>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2,
            bgcolor: 'grey.900',
            color: 'grey.100',
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {ENABLE_COMMAND}
        </Box>
        <Typography variant="caption" color="text.secondary">
          The operator restarts with the upgrade controller on. Then create an analysis.
        </Typography>
        {mirrorName && (
          <>
            <Divider />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="body2">
                The cluster mirror is live
                {atRisk !== undefined &&
                  ` — ${atRisk} component${atRisk === 1 ? ' is' : 's are'} at risk right now`}
                .
              </Typography>
              <Link routeName="clusterMirrorDetail" params={{ name: mirrorName }}>
                Open Cluster Mirror →
              </Link>
            </Box>
          </>
        )}
      </Box>
    </SectionBox>
  );
}
