import {test} from 'node:test';
import assert from 'node:assert/strict';
import {socialImageUrl} from '../../src/seo/social.ts';

test('preview image URLs remain in the explicit site namespace',()=>{
  for(const origin of ['https://staging.agenticbible.si','https://agenticbible.si']){
    assert.equal(socialImageUrl(undefined,origin),null);
    assert.equal(socialImageUrl('/social-preview.png',origin),origin+'/social-preview.png');
    assert.equal(socialImageUrl('/images/article-preview.webp',origin),origin+'/images/article-preview.webp');
    for(const value of ['//localhost/foo.png','//foreign.example/foo.png','https://foreign.example/foo.png','/../secret.png','/%2f%2fforeign.png','/image.png?token=private','/image.svg','/image.png#fragment','/image\\bad.png','',null,{}])assert.throws(()=>socialImageUrl(value,origin),/invalid_social_image/);
  }
  assert.throws(()=>socialImageUrl('/image.png','https://foreign.example'),/invalid_social_origin/);
});
