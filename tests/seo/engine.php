<?php
define('ABSPATH',1);
require __DIR__.'/../../oxygen-ac-automation/includes/class-oxygen-seo-engine.php';
$plan=Oxygen_SEO_Engine::plan(); $f=0;
echo "plan=".count($plan)."\n";
$keys=array_column($plan,'key'); $titles=array_column($plan,'title'); $kws=array_column($plan,'kw');
foreach(['keys'=>$keys,'titles'=>$titles,'kws'=>$kws] as $n=>$a) echo "$n unique: ".count(array_unique($a))."\n";
$min=9999;$minc=9999;
foreach($plan as $it){ $b=Oxygen_SEO_Engine::build($it,0,['app'=>'#','wa'=>'966500']); $w=Oxygen_SEO_Engine::word_count($b['html']);
 if($it['track']==='official'){ $min=min($min,$w); if($w<500){$f++; echo "SHORT $w {$it['key']}\n";} } else $minc=min($minc,$w); }
echo "min official words=$min, min commercial=$minc\n";
$seen=[]; $it=$plan[0];
for($r=0;$r<24;$r++){ $seen[Oxygen_SEO_Engine::build($it,$r)['html']]=1; }
echo "distinct revisions of one article (24): ".count($seen)."\n";
$s2=[];for($r=0;$r<24;$r++)$s2[Oxygen_SEO_Engine::angle_index(5,$r)]=1; echo "angles: ".count($s2)."\n";
echo strlen(Oxygen_SEO_Engine::cover_svg('عنوان تجريبي طويل جدا لاختبار التفاف الأسطر','x','s'))>200?"svg ok\n":"svg bad\n";
exit($f?1:0);
