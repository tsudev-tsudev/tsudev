#!/usr/bin/env node
(async () => {
  try {
    const presignUrl = 'http://localhost:4002/api/presign?fileName=test.txt&contentType=text/plain';
    console.log('Requesting presign:', presignUrl);
    const presignResp = await fetch(presignUrl);
    const presignJson = await presignResp.json();
    console.log('PRESIGN_RESPONSE:', JSON.stringify(presignJson, null, 2));
    if (!presignJson || !presignJson.url) {
      console.error('No url in presign response');
      process.exit(2);
    }
    const putUrl = presignJson.url;
    console.log('Uploading to presigned URL...');
    try {
      const putResp = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: 'hello from automation',
      });
      console.log('PUT status:', putResp.status, putResp.statusText);
      const text = await putResp.text();
      if (text) console.log('PUT response body:', text);
    } catch (putErr) {
      console.warn(
        'Presigned PUT failed, attempting server-side upload fallback:',
        putErr && putErr.message
      );
      // Attempt server-side fallback endpoint which uploads using the service's S3 client
      try {
        const fallbackUrl = `http://localhost:4002/api/upload?key=${encodeURIComponent(
          presignJson.key
        )}`;
        console.log('Calling server-side upload:', fallbackUrl);
        const srvResp = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: 'hello from server-side fallback',
        });
        console.log('Server-side upload status:', srvResp.status, srvResp.statusText);
        console.log('Server response:', await srvResp.text());
      } catch (srvErr) {
        console.error('Server-side fallback failed:', srvErr);
      }
    }

    console.log('Listing files...');
    const filesResp = await fetch('http://localhost:4002/api/files');
    const filesJson = await filesResp.json();
    console.log('FILES:', JSON.stringify(filesJson, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();
